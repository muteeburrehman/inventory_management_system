import { useState } from "react";
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createPurchase, deletePurchase, getPurchase, listPurchases, updatePurchase } from "../../api/purchases.js";
import { listProducts } from "../../api/products.js";
import { listSuppliers } from "../../api/suppliers.js";
import { listBranches } from "../../api/settings.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

const PAYMENT = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "credit", label: "Credit" },
];

const STATUS_OPTS = [
  { value: "pending", label: "Pending" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

function lineSubtotal(qty, price, discount, tax) {
  const q = Number(qty) || 0;
  const p = Number(price) || 0;
  const d = Number(discount) || 0;
  const t = Number(tax) || 0;
  return Math.max(0, q * p - d + t);
}

export function PurchasesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  const [poPage, setPoPage] = useState(1);
  const [poPageSize, setPoPageSize] = useState(25);

  const purQ = useQuery({
    queryKey: ["purchases", poPage, poPageSize],
    queryFn: () => listPurchases({ page: poPage, page_size: poPageSize }),
  });
  const supQ = useQuery({
    queryKey: ["suppliers", "po-options"],
    queryFn: () => listSuppliers({ page: 1, page_size: 100 }),
  });
  const prodQ = useQuery({
    queryKey: ["products-po-options"],
    queryFn: () => listProducts({ page: 1, page_size: 100 }),
  });
  const brQ = useQuery({
    queryKey: ["branches", "po-options"],
    queryFn: () => listBranches({ page: 1, page_size: 100 }),
  });

  const saveMut = useMutation({
    mutationFn: async ({ id, values }) => {
      const items = (values.items || []).map((row) => ({
        product: row.product,
        variant: row.variant || null,
        quantity: Number(row.quantity),
        purchase_price: String(row.purchase_price),
        tax: String(row.tax ?? 0),
        discount: String(row.discount ?? 0),
        subtotal: String(
          lineSubtotal(row.quantity, row.purchase_price, row.discount, row.tax),
        ),
      }));
      const body = {
        supplier: values.supplier,
        purchase_date: values.purchase_date.format("YYYY-MM-DD"),
        total_amount: String(values.total_amount ?? 0),
        discount: String(values.discount ?? 0),
        tax: String(values.tax ?? 0),
        extra_charges: String(values.extra_charges ?? 0),
        paid_amount: String(values.paid_amount ?? 0),
        due_amount: String(values.due_amount ?? 0),
        payment_mode: values.payment_mode || "cash",
        status: values.status || "pending",
        branch: values.branch || undefined,
        items,
      };
      if (id) return updatePurchase(id, body);
      return createPurchase(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      message.success(editingId ? "Purchase updated." : "Purchase created.");
      setModalOpen(false);
      setEditingId(null);
      form.resetFields();
    },
    onError: (e) => message.error(e?.response?.data?.message || JSON.stringify(e?.response?.data) || "Save failed."),
  });

  const delMut = useMutation({
    mutationFn: deletePurchase,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["purchases"], refetchType: "all" });
      message.success("Deleted.");
    },
    onError: () => message.error("Delete failed."),
  });

  const openNew = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      items: [{ quantity: 1, purchase_price: 0, tax: 0, discount: 0 }],
      purchase_date: dayjs(),
      status: "pending",
      payment_mode: "cash",
      total_amount: 0,
      paid_amount: 0,
      due_amount: 0,
    });
    setModalOpen(true);
  };

  const openEdit = async (row) => {
    try {
      const po = await getPurchase(row.id);
      setEditingId(po.id);
      form.setFieldsValue({
        supplier: po.supplier,
        purchase_date: po.purchase_date ? dayjs(po.purchase_date) : dayjs(),
        total_amount: Number(po.total_amount),
        discount: Number(po.discount),
        tax: Number(po.tax),
        extra_charges: Number(po.extra_charges),
        paid_amount: Number(po.paid_amount),
        due_amount: Number(po.due_amount),
        payment_mode: po.payment_mode,
        status: po.status,
        branch: po.branch,
        items: (po.items || []).map((i) => ({
          product: i.product,
          variant: i.variant,
          quantity: i.quantity,
          purchase_price: i.purchase_price,
          tax: i.tax,
          discount: i.discount,
        })),
      });
      setModalOpen(true);
    } catch {
      message.error("Could not load purchase detail.");
    }
  };

  const purchaseRows = purQ.data?.results ?? [];
  const purchaseTotal = purQ.data?.count ?? 0;
  const supplierRows = supQ.data?.results ?? (Array.isArray(supQ.data) ? supQ.data : []);
  const productRows = prodQ.data?.results ?? (Array.isArray(prodQ.data) ? prodQ.data : []);
  const supplierMap = Object.fromEntries(supplierRows.map((s) => [s.id, s.name]));

  const columns = [
    { title: "Invoice", dataIndex: "invoice_number", key: "inv", width: 120 },
    {
      title: "Supplier",
      dataIndex: "supplier",
      key: "s",
      ellipsis: true,
      render: (id) => supplierMap[id] ?? id,
    },
    { title: "Date", dataIndex: "purchase_date", key: "d", width: 110 },
    {
      title: "Total",
      dataIndex: "total_amount",
      key: "t",
      width: 110,
      render: (v) => formatCurrency(v),
    },
    { title: "Status", dataIndex: "status", key: "st", width: 100 },
    {
      title: "Actions",
      key: "a",
      width: 120,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this order?" onConfirm={() => delMut.mutateAsync(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const prodOptions = productRows.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));

  return (
    <PageShell
      title="Purchases"
      description="Purchase orders, receive workflow, and supplier balances (PRD §6)."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Purchasing" }, { title: "Purchases" }]}
    >
      <Card
        bordered={false}
        className="ims-card"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
            New purchase
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={purQ.isLoading}
          columns={columns}
          dataSource={purchaseRows}
          pagination={antServerPagination({
            page: poPage,
            pageSize: poPageSize,
            total: purchaseTotal,
            onChange: (p, ps) => {
              setPoPage(p);
              setPoPageSize(ps);
            },
          })}
        />
      </Card>

      <Modal
        title={editingId ? `Edit ${editingId}` : "New purchase"}
        open={modalOpen}
        width={720}
        onCancel={() => {
          setModalOpen(false);
          setEditingId(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => saveMut.mutate({ id: editingId, values })}
        >
          <Space wrap style={{ width: "100%" }}>
            <Form.Item name="supplier" label="Supplier" rules={[{ required: true }]} style={{ minWidth: 200 }}>
              <Select
                showSearch
                optionFilterProp="label"
                options={supplierRows.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
            <Form.Item name="purchase_date" label="Date" rules={[{ required: true }]} style={{ minWidth: 200 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="branch" label="Branch" style={{ minWidth: 180 }}>
              <Select allowClear placeholder="Default (your branch)" options={(brQ.data?.results ?? []).map((b) => ({ value: b.id, label: b.name }))} />
            </Form.Item>
            <Form.Item name="status" label="Status" rules={[{ required: true }]} style={{ minWidth: 160 }}>
              <Select options={STATUS_OPTS} />
            </Form.Item>
            <Form.Item name="payment_mode" label="Payment" style={{ minWidth: 140 }}>
              <Select options={PAYMENT} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="total_amount" label="Total">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="discount" label="Discount">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="tax" label="Tax">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="extra_charges" label="Extra">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="paid_amount" label="Paid">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="due_amount" label="Due">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
          </Space>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="start" style={{ display: "flex", marginBottom: 8 }} wrap>
                    <Form.Item {...field} name={[field.name, "product"]} rules={[{ required: true }]} style={{ minWidth: 240 }}>
                      <Select showSearch optionFilterProp="label" options={prodOptions} placeholder="Product" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, "quantity"]} rules={[{ required: true }]} initialValue={1}>
                      <InputNumber min={1} placeholder="Qty" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, "purchase_price"]} rules={[{ required: true }]}>
                      <InputNumber min={0} placeholder="Price" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, "discount"]} initialValue={0}>
                      <InputNumber min={0} placeholder="Disc" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, "tax"]} initialValue={0}>
                      <InputNumber min={0} placeholder="Tax" />
                    </Form.Item>
                    <Button onClick={() => remove(field.name)} danger type="link">
                      Remove
                    </Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block style={{ marginBottom: 16 }}>
                  Add line
                </Button>
              </>
            )}
          </Form.List>

          <Button type="primary" htmlType="submit" loading={saveMut.isPending} block>
            Save purchase
          </Button>
        </Form>
      </Modal>
    </PageShell>
  );
}
