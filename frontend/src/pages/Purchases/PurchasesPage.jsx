import { useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  createPurchase,
  deletePurchase,
  getPurchase,
  listPurchases,
  receivePurchase,
  updatePurchase,
} from "../../api/purchases.js";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton.jsx";
import { listProducts } from "../../api/products.js";
import { listSuppliers } from "../../api/suppliers.js";
import { listBranches } from "../../api/settings.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { applyDrfFieldErrors, envelopeMessage } from "../../utils/apiErrors.js";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

const PAYMENT = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "credit", label: "Credit" },
];

const STATUS_OPTS = [
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partially received" },
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

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** DRF decimals often arrive as strings — coerce for InputNumber + { type: "number" } rules. */
function toNum(v, fallback = 0) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Ant Design `type: "number"` rejects string decimals from the API — validate with Number() instead. */
function ruleRequiredMoney(labelShort) {
  return {
    validator(_, v) {
      if (v === undefined || v === null || v === "") {
        return Promise.reject(new Error(`Enter ${labelShort}.`));
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return Promise.reject(new Error("Use a valid amount (numbers only)."));
      }
      return Promise.resolve();
    },
  };
}

function ruleOptionalMoney() {
  return {
    validator(_, v) {
      if (v === undefined || v === null || v === "") return Promise.resolve();
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return Promise.reject(new Error("Use a valid amount or leave empty."));
      }
      return Promise.resolve();
    },
  };
}

function ruleQty() {
  return {
    validator(_, v) {
      if (v === undefined || v === null || v === "") {
        return Promise.reject(new Error("Enter quantity."));
      }
      const n = parseInt(String(v), 10);
      if (!Number.isFinite(n) || n < 1) {
        return Promise.reject(new Error("Whole number ≥ 1."));
      }
      return Promise.resolve();
    },
  };
}

const moneyRules = (label) => [ruleRequiredMoney(label)];
const moneyOptionalRules = [ruleOptionalMoney()];

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
    onError: (e) => {
      if (!applyDrfFieldErrors(form, e)) {
        message.error(envelopeMessage(e));
      }
    },
  });

  const delMut = useMutation({
    mutationFn: deletePurchase,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["purchases"], refetchType: "all" });
      message.success("Deleted.");
    },
    onError: () => message.error("Delete failed."),
  });

  const receiveMut = useMutation({
    mutationFn: (id) => receivePurchase(id, {}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["purchases"] });
      message.success("Stock received.");
    },
    onError: (e) => message.error(e?.response?.data?.detail || "Receive failed."),
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
      discount: 0,
      tax: 0,
      extra_charges: 0,
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
        total_amount: toNum(po.total_amount),
        discount: toNum(po.discount),
        tax: toNum(po.tax),
        extra_charges: toNum(po.extra_charges),
        paid_amount: toNum(po.paid_amount),
        due_amount: toNum(po.due_amount),
        payment_mode: po.payment_mode,
        status: po.status,
        branch: po.branch,
        items: (po.items || []).map((i) => ({
          product: i.product,
          variant: i.variant,
          quantity: Math.max(1, parseInt(String(i.quantity), 10) || 1),
          purchase_price: toNum(i.purchase_price),
          tax: toNum(i.tax),
          discount: toNum(i.discount),
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
      width: 200,
      fixed: "right",
      render: (_, r) => (
        <Space size="small" wrap>
          {r.status !== "received" && r.status !== "cancelled" && (
            <Button
              type="link"
              size="small"
              loading={receiveMut.isPending}
              onClick={() => receiveMut.mutate(r.id)}
            >
              Receive
            </Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <ConfirmDeleteButton
            title="Delete this order?"
            onConfirm={() => delMut.mutateAsync(r.id)}
            icon={<DeleteOutlined />}
          >
            {null}
          </ConfirmDeleteButton>
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
          scroll={{ x: 720 }}
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
        width={820}
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
          onValuesChange={(changed, all) => {
            if ("total_amount" in changed || "paid_amount" in changed) {
              const t = Number(all.total_amount) || 0;
              const p = Number(all.paid_amount) || 0;
              form.setFieldsValue({ due_amount: roundMoney(Math.max(0, t - p)) });
            }
          }}
          onFinish={(values) => saveMut.mutate({ id: editingId, values })}
        >
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 10 }}>
            All amounts are Rs (numbers only). Paid + Due must equal Total — Due updates from Total − Paid.
          </Typography.Text>

          <Row gutter={[12, 8]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="supplier" label="Supplier" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={supplierRows.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="purchase_date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="branch" label="Branch">
                <Select
                  allowClear
                  placeholder="Your branch"
                  options={(brQ.data?.results ?? []).map((b) => ({ value: b.id, label: b.name }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={12}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select options={STATUS_OPTS} />
              </Form.Item>
            </Col>
            <Col xs={12} md={12}>
              <Form.Item name="payment_mode" label="Payment">
                <Select options={PAYMENT} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
            <Space align="start" size={12} wrap={false} style={{ minWidth: 760 }}>
              <Form.Item name="total_amount" label="Total Rs" rules={moneyRules("total")} style={{ marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} precision={2} style={{ width: 110 }} controls />
              </Form.Item>
              <Form.Item name="discount" label="Order off Rs" rules={moneyOptionalRules} initialValue={0} style={{ marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} precision={2} style={{ width: 110 }} controls />
              </Form.Item>
              <Form.Item name="tax" label="Order tax Rs" rules={moneyOptionalRules} initialValue={0} style={{ marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} precision={2} style={{ width: 110 }} controls />
              </Form.Item>
              <Form.Item name="extra_charges" label="Freight Rs" rules={moneyOptionalRules} initialValue={0} style={{ marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} precision={2} style={{ width: 110 }} controls />
              </Form.Item>
              <Form.Item
                name="paid_amount"
                label="Paid Rs"
                dependencies={["total_amount", "due_amount"]}
                rules={[...moneyRules("paid amount")]}
                initialValue={0}
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={0} step={0.01} precision={2} style={{ width: 110 }} controls />
              </Form.Item>
              <Form.Item
                name="due_amount"
                label="Due Rs"
                dependencies={["total_amount", "paid_amount"]}
                rules={[
                  ...moneyRules("due amount"),
                  ({ getFieldValue }) => ({
                    validator(_, dueVal) {
                      const total = Number(getFieldValue("total_amount")) || 0;
                      const paid = Number(getFieldValue("paid_amount")) || 0;
                      const due = Number(dueVal) || 0;
                      if (Math.abs(paid + due - total) > 0.021) {
                        return Promise.reject(new Error(`Paid + Due must equal Total (${total.toFixed(2)}).`));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
                initialValue={0}
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={0} step={0.01} precision={2} style={{ width: 110 }} controls />
              </Form.Item>
            </Space>
          </div>

          <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>
            Products bought
          </Typography.Title>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Card key={field.key} size="small" type="inner" style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12,
                        alignItems: "flex-end",
                      }}
                    >
                      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <Form.Item {...field} name={[field.name, "product"]} label="Product" rules={[{ required: true, message: "Pick product." }]}>
                          <Select showSearch optionFilterProp="label" options={prodOptions} />
                        </Form.Item>
                      </div>
                      <div style={{ flex: "0 0 72px" }}>
                        <Form.Item
                          {...field}
                          name={[field.name, "quantity"]}
                          label="Qty"
                          rules={[ruleQty()]}
                          initialValue={1}
                        >
                          <InputNumber min={1} precision={0} style={{ width: "100%" }} controls />
                        </Form.Item>
                      </div>
                      <div style={{ flex: "0 0 100px" }}>
                        <Form.Item
                          {...field}
                          name={[field.name, "purchase_price"]}
                          label="Rate Rs"
                          rules={[ruleRequiredMoney("rate")]}
                        >
                          <InputNumber min={0} step={0.01} precision={2} style={{ width: "100%" }} controls />
                        </Form.Item>
                      </div>
                      <div style={{ flex: "0 0 100px" }}>
                        <Form.Item {...field} name={[field.name, "discount"]} label="Off Rs" initialValue={0} rules={moneyOptionalRules}>
                          <InputNumber min={0} step={0.01} precision={2} style={{ width: "100%" }} controls />
                        </Form.Item>
                      </div>
                      <div style={{ flex: "0 0 100px" }}>
                        <Form.Item {...field} name={[field.name, "tax"]} label="Tax Rs" initialValue={0} rules={moneyOptionalRules}>
                          <InputNumber min={0} step={0.01} precision={2} style={{ width: "100%" }} controls />
                        </Form.Item>
                      </div>
                      <div style={{ flex: "0 0 auto", paddingBottom: 2 }}>
                        <Button danger type="link" onClick={() => remove(field.name)} disabled={fields.length <= 1}>
                          Remove row
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ quantity: 1, purchase_price: 0, tax: 0, discount: 0 })} block style={{ marginBottom: 16 }}>
                  Add row
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
