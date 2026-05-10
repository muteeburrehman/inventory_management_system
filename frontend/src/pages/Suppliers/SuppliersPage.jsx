import { useState } from "react";
import {
  App,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  getSupplierLedger,
  getSupplierPurchaseHistory,
  listSuppliers,
  updateSupplier,
} from "../../api/suppliers.js";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton.jsx";
import { listBranches } from "../../api/settings.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { useAuthStore } from "../../store/authStore.js";
import { envelopeMessage } from "../../utils/apiErrors.js";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

const empty = {
  name: "",
  company_name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  tax_number: "",
  payment_terms: "",
  opening_balance: 0,
  credit_limit: 0,
  branch_ids: [],
};

function decimalFormValue(v) {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function SuppliersPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const branchId = useAuthStore((s) => s.user?.branch?.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["suppliers", branchId, page, pageSize],
    queryFn: () => listSuppliers({ page, page_size: pageSize }),
  });
  const branchesQ = useQuery({
    queryKey: ["branches", "suppliers-form"],
    queryFn: () => listBranches({ page_size: 100 }),
    enabled: modalOpen || Boolean(detailId),
  });

  const detailQ = useQuery({
    queryKey: ["suppliers", detailId],
    queryFn: () => getSupplier(detailId),
    enabled: detailId != null,
  });
  const ledgerQ = useQuery({
    queryKey: ["suppliers", detailId, "ledger"],
    queryFn: () => getSupplierLedger(detailId),
    enabled: detailId != null,
  });
  const historyQ = useQuery({
    queryKey: ["suppliers", detailId, "purchase-history"],
    queryFn: () => getSupplierPurchaseHistory(detailId),
    enabled: detailId != null,
  });

  const rows = pageData?.results ?? [];
  const total = pageData?.count ?? 0;
  const supplier = detailQ.data;
  const ledger = ledgerQ.data;
  const purchases = Array.isArray(historyQ.data) ? historyQ.data : [];

  const saveMut = useMutation({
    mutationFn: ({ id, values }) => (id ? updateSupplier(id, values) : createSupplier(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      if (detailId) {
        qc.invalidateQueries({ queryKey: ["suppliers", detailId] });
        qc.invalidateQueries({ queryKey: ["suppliers", detailId, "ledger"] });
        qc.invalidateQueries({ queryKey: ["suppliers", detailId, "purchase-history"] });
      }
      message.success(editing ? "Supplier updated." : "Supplier created.");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e) => {
      message.error(envelopeMessage(e));
    },
  });

  const delMut = useMutation({
    mutationFn: (id) => deleteSupplier(id),
    onSuccess: () => {
      setDetailId(null);
      message.success("Deleted.");
      void qc.invalidateQueries({ queryKey: ["suppliers"], refetchType: "all" });
    },
    onError: (e) => message.error(envelopeMessage(e)),
  });

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setModalOpen(true);
  };

  const columns = [
    { title: "Supplier name", dataIndex: "name", key: "name", ellipsis: true },
    { title: "Contact", dataIndex: "contact_person", key: "cp", width: 130, ellipsis: true, render: (t) => t || "—" },
    { title: "Company", dataIndex: "company_name", key: "company", ellipsis: true, render: (t) => t || "—" },
    { title: "Phone", dataIndex: "phone", key: "phone", width: 120 },
    { title: "Email", dataIndex: "email", key: "email", ellipsis: true },
    {
      title: "Branches",
      key: "br",
      ellipsis: true,
      render: (_, r) =>
        r.branches?.length ? r.branches.map((b) => b.name).join(", ") : "—",
    },
    {
      title: "Balance",
      dataIndex: "current_balance",
      key: "bal",
      width: 120,
      render: (v) => formatCurrency(v),
    },
    {
      title: "Actions",
      key: "act",
      width: 220,
      render: (_, r) => (
        <Space wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)}>
            View
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            Edit
          </Button>
          <ConfirmDeleteButton
            title="Delete this supplier?"
            onConfirm={() => delMut.mutateAsync(r.id)}
            icon={<DeleteOutlined />}
            disabled={delMut.isPending}
          >
            Delete
          </ConfirmDeleteButton>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    { title: "Invoice", dataIndex: "invoice_number", width: 110 },
    { title: "Date", dataIndex: "purchase_date", width: 110 },
    { title: "Total", dataIndex: "total_amount", render: (v) => formatCurrency(v), width: 110 },
    { title: "Paid", dataIndex: "paid_amount", render: (v) => formatCurrency(v), width: 110 },
    { title: "Due", dataIndex: "due_amount", render: (v) => formatCurrency(v), width: 110 },
    {
      title: "Status",
      dataIndex: "status",
      width: 100,
      render: (s) => <Tag>{s}</Tag>,
    },
  ];

  return (
    <PageShell
      title="Supplier management"
      description="Add and edit vendors, contact and tax details, payment terms, and review purchase ledger totals."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Parties" }, { title: "Suppliers" }]}
    >
      <Card
        bordered={false}
        className="ims-card"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
            Add supplier
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 980 }}
          pagination={antServerPagination({
            page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          })}
        />
      </Card>

      <Modal
        title={editing ? "Edit supplier" : "Add supplier"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        footer={null}
        destroyOnClose
        width={600}
      >
        <Form
          layout="vertical"
          key={editing?.id ?? `new-${branchId ?? "nobranch"}`}
          initialValues={
            editing
              ? {
                  ...editing,
                  contact_person: editing.contact_person ?? "",
                  payment_terms: editing.payment_terms ?? "",
                  branch_ids: editing.branches?.map((b) => b.id) ?? [],
                  opening_balance: decimalFormValue(editing.opening_balance),
                  credit_limit: decimalFormValue(editing.credit_limit),
                  current_balance: decimalFormValue(editing.current_balance),
                }
              : { ...empty, branch_ids: branchId ? [branchId] : [] }
          }
          onFinish={(values) => {
            const payload = {
              name: values.name,
              company_name: values.company_name ?? "",
              contact_person: values.contact_person ?? "",
              phone: values.phone ?? "",
              email: values.email ?? "",
              address: values.address ?? "",
              tax_number: values.tax_number ?? "",
              payment_terms: values.payment_terms ?? "",
              opening_balance: decimalFormValue(values.opening_balance),
              credit_limit: decimalFormValue(values.credit_limit),
              branch_ids: values.branch_ids ?? [],
            };
            if (editing?.id) {
              payload.current_balance = decimalFormValue(values.current_balance);
            }
            saveMut.mutate({ id: editing?.id, values: payload });
          }}
        >
          <Form.Item name="name" label="Supplier name" rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="Vendor / trading name" />
          </Form.Item>
          <Form.Item name="contact_person" label="Contact person">
            <Input placeholder="Primary contact" />
          </Form.Item>
          <Form.Item name="company_name" label="Company / legal name">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item
            name="branch_ids"
            label="Branches"
            rules={[{ required: true, type: "array", min: 1, message: "Select at least one branch" }]}
          >
            <Select
              mode="multiple"
              allowClear
              placeholder={branchesQ.isLoading ? "Loading branches…" : "Where this supplier is used"}
              loading={branchesQ.isLoading}
              options={(branchesQ.data?.results ?? []).map((b) => ({
                value: b.id,
                label: b.is_active === false ? `${b.name} (inactive)` : b.name,
                disabled: b.is_active === false,
              }))}
            />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: "email", message: "Enter a valid email" }]}
          >
            <Input placeholder="accounts@vendor.com" />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} placeholder="Street, city, country" />
          </Form.Item>
          <Form.Item name="tax_number" label="Tax / GST number">
            <Input placeholder="NTN / TRN / VAT ID" />
          </Form.Item>
          <Form.Item name="payment_terms" label="Payment terms">
            <Input.TextArea rows={2} placeholder="e.g. Net 30, 50% advance, COD" />
          </Form.Item>
          <Form.Item
            name="opening_balance"
            label="Opening balance"
            dependencies={["credit_limit"]}
            extra="Amount you already owed this supplier before this system (numbers only). Usually 0."
            rules={[
              { type: "number", min: 0, message: "Enter zero or a positive amount." },
              ({ getFieldValue }) => ({
                validator(_, opening) {
                  const lim = Number(getFieldValue("credit_limit") ?? 0);
                  const ob = Number(opening ?? 0);
                  if (lim > 0 && ob > lim) {
                    return Promise.reject(
                      new Error(
                        "Opening balance cannot be higher than credit limit — raise limit or lower this amount.",
                      ),
                    );
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <InputNumber min={0} style={{ width: "100%" }} step={0.01} precision={2} controls />
          </Form.Item>
          <Form.Item
            name="credit_limit"
            label="Credit limit"
            dependencies={["opening_balance"]}
            extra="Max total payable on credit to this vendor (must be ≥ opening balance if both above zero). 0 if no credit purchases."
            rules={[
              { type: "number", min: 0, message: "Enter zero or a positive amount." },
              ({ getFieldValue }) => ({
                validator(_, creditLim) {
                  const opening = Number(getFieldValue("opening_balance") ?? 0);
                  const lim = Number(creditLim ?? 0);
                  if (lim > 0 && opening > lim) {
                    return Promise.reject(
                      new Error(
                        "Credit limit must be at least equal to opening balance (starting payable cannot exceed the limit).",
                      ),
                    );
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <InputNumber min={0} style={{ width: "100%" }} step={0.01} precision={2} controls />
          </Form.Item>
          {editing && (
            <Form.Item
              name="current_balance"
              label="Current balance"
              dependencies={["credit_limit"]}
              extra="How much you owe them now (from purchases). Adjust only to fix mistakes. Cannot exceed credit limit when limit is set."
              rules={[
                { type: "number", min: 0, message: "Enter zero or more." },
                ({ getFieldValue }) => ({
                  validator(_, due) {
                    const lim = Number(getFieldValue("credit_limit") ?? 0);
                    const d = Number(due ?? 0);
                    if (lim > 0 && d > lim) {
                      return Promise.reject(
                        new Error("Balance is above credit limit — raise limit or lower balance."),
                      );
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <InputNumber min={0} style={{ width: "100%" }} step={0.01} precision={2} controls />
            </Form.Item>
          )}
          <Button type="primary" htmlType="submit" loading={saveMut.isPending} block>
            Save
          </Button>
        </Form>
      </Modal>

      <Drawer
        title={supplier?.name ?? "Supplier"}
        width={720}
        open={detailId != null}
        onClose={() => setDetailId(null)}
        destroyOnClose
      >
        {detailQ.isLoading ? (
          <Typography.Paragraph type="secondary">Loading…</Typography.Paragraph>
        ) : supplier ? (
          <>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Supplier name">{supplier.name}</Descriptions.Item>
              <Descriptions.Item label="Contact person">{supplier.contact_person || "—"}</Descriptions.Item>
              <Descriptions.Item label="Company">{supplier.company_name || "—"}</Descriptions.Item>
              <Descriptions.Item label="Phone">{supplier.phone || "—"}</Descriptions.Item>
              <Descriptions.Item label="Email">{supplier.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="Address">{supplier.address || "—"}</Descriptions.Item>
              <Descriptions.Item label="Tax / GST">{supplier.tax_number || "—"}</Descriptions.Item>
              <Descriptions.Item label="Payment terms">{supplier.payment_terms || "—"}</Descriptions.Item>
              <Descriptions.Item label="Opening balance">{formatCurrency(supplier.opening_balance)}</Descriptions.Item>
              <Descriptions.Item label="Branches">
                {supplier.branches?.length
                  ? supplier.branches.map((b) => b.name).join(", ")
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Credit limit">{formatCurrency(supplier.credit_limit)}</Descriptions.Item>
              <Descriptions.Item label="Current balance">{formatCurrency(supplier.current_balance)}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Supplier ledger (purchases)</Divider>
            {ledgerQ.isLoading ? (
              <Typography.Text type="secondary">Loading ledger…</Typography.Text>
            ) : ledger ? (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Space size="large" wrap>
                  <div>
                    <Typography.Text type="secondary">Orders (non-cancelled)</Typography.Text>
                    <div>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {ledger.purchase_count ?? 0}
                      </Typography.Title>
                    </div>
                  </div>
                  <div>
                    <Typography.Text type="secondary">Total purchases</Typography.Text>
                    <div>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {formatCurrency(ledger.total_purchases)}
                      </Typography.Title>
                    </div>
                  </div>
                  <div>
                    <Typography.Text type="secondary">Paid amount</Typography.Text>
                    <div>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {formatCurrency(ledger.paid_amount)}
                      </Typography.Title>
                    </div>
                  </div>
                  <div>
                    <Typography.Text type="secondary">Due amount</Typography.Text>
                    <div>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {formatCurrency(ledger.due_amount)}
                      </Typography.Title>
                    </div>
                  </div>
                </Space>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  Totals are summed from purchase orders in branches you can access (excluding cancelled).
                </Typography.Paragraph>
              </Card>
            ) : null}

            <Divider orientation="left">Recent purchase orders</Divider>
            <Table
              size="small"
              rowKey="id"
              loading={historyQ.isLoading}
              dataSource={purchases}
              columns={historyColumns}
              pagination={false}
            />
            <Space style={{ marginTop: 16 }}>
              <Button
                type="primary"
                onClick={() => {
                  setDetailId(null);
                  openEdit(supplier);
                }}
              >
                Edit supplier
              </Button>
              <ConfirmDeleteButton
                title="Delete this supplier?"
                onConfirm={async () => {
                  await delMut.mutateAsync(supplier.id);
                }}
                disabled={delMut.isPending}
              >
                Delete supplier
              </ConfirmDeleteButton>
            </Space>
          </>
        ) : (
          <Typography.Text type="danger">Could not load supplier.</Typography.Text>
        )}
      </Drawer>
    </PageShell>
  );
}
