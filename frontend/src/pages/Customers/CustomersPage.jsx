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
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomerLedger,
  getCustomerPaymentHistory,
  getCustomerPurchaseHistory,
  listCustomers,
  updateCustomer,
} from "../../api/customers.js";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton.jsx";
import { listBranches } from "../../api/settings.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { useAuthStore } from "../../store/authStore.js";
import { envelopeMessage } from "../../utils/apiErrors.js";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

const types = [
  { value: "retail", label: "Retail" },
  { value: "wholesale", label: "Wholesale" },
  { value: "vip", label: "VIP" },
];

const empty = {
  name: "",
  phone: "",
  email: "",
  address: "",
  customer_type: "retail",
  opening_balance: 0,
  credit_limit: 0,
  reward_points: 0,
  branch_ids: [],
};

function decimalFormValue(v) {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function intFormValue(v) {
  if (v == null || v === "") return 0;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

export function CustomersPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const branchId = useAuthStore((s) => s.user?.branch?.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["customers", branchId, page, pageSize],
    queryFn: () => listCustomers({ page, page_size: pageSize }),
  });
  const branchesQ = useQuery({
    queryKey: ["branches", "customers-form"],
    queryFn: () => listBranches({ page_size: 100 }),
    enabled: modalOpen || Boolean(detailId),
  });

  const detailQ = useQuery({
    queryKey: ["customers", detailId],
    queryFn: () => getCustomer(detailId),
    enabled: detailId != null,
  });
  const ledgerQ = useQuery({
    queryKey: ["customers", detailId, "ledger"],
    queryFn: () => getCustomerLedger(detailId),
    enabled: detailId != null,
  });
  const historyQ = useQuery({
    queryKey: ["customers", detailId, "purchase-history"],
    queryFn: () => getCustomerPurchaseHistory(detailId),
    enabled: detailId != null,
  });
  const paymentsQ = useQuery({
    queryKey: ["customers", detailId, "payment-history"],
    queryFn: () => getCustomerPaymentHistory(detailId),
    enabled: detailId != null,
  });

  const rows = pageData?.results ?? [];
  const total = pageData?.count ?? 0;
  const customer = detailQ.data;
  const ledger = ledgerQ.data;
  const sales = Array.isArray(historyQ.data) ? historyQ.data : [];
  const payments = Array.isArray(paymentsQ.data) ? paymentsQ.data : [];

  const saveMut = useMutation({
    mutationFn: ({ id, values }) => (id ? updateCustomer(id, values) : createCustomer(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      if (detailId) {
        qc.invalidateQueries({ queryKey: ["customers", detailId] });
        qc.invalidateQueries({ queryKey: ["customers", detailId, "ledger"] });
        qc.invalidateQueries({ queryKey: ["customers", detailId, "purchase-history"] });
        qc.invalidateQueries({ queryKey: ["customers", detailId, "payment-history"] });
      }
      message.success(editing ? "Customer updated." : "Customer created.");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e) => message.error(envelopeMessage(e)),
  });

  const delMut = useMutation({
    mutationFn: (id) => deleteCustomer(id),
    onSuccess: () => {
      // Close detail queries before invalidating so we never refetch a deleted id (404 / flaky modal promise).
      setDetailId(null);
      message.success("Deleted.");
      void qc.invalidateQueries({ queryKey: ["customers"], refetchType: "all" });
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

  const saleColumns = [
    { title: "Invoice", dataIndex: "invoice_number", width: 110 },
    {
      title: "Date",
      dataIndex: "sale_date",
      width: 160,
      render: (d) => (d ? String(d).replace("T", " ").slice(0, 19) : "—"),
    },
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

  const paymentColumns = [
    { title: "Invoice", dataIndex: "invoice_number", width: 110 },
    {
      title: "Date",
      dataIndex: "sale_date",
      width: 160,
      render: (d) => (d ? String(d).replace("T", " ").slice(0, 19) : "—"),
    },
    { title: "Mode", dataIndex: "payment_mode", width: 100 },
    { title: "Amount", dataIndex: "amount", render: (v) => formatCurrency(v), width: 110 },
    { title: "Branch", dataIndex: "branch_name", ellipsis: true },
  ];

  const columns = [
    { title: "Name", dataIndex: "name", ellipsis: true },
    { title: "Phone", dataIndex: "phone", width: 120 },
    { title: "Email", dataIndex: "email", ellipsis: true },
    {
      title: "Branches",
      key: "br",
      ellipsis: true,
      render: (_, r) =>
        r.branches?.length ? r.branches.map((b) => b.name).join(", ") : "—",
    },
    {
      title: "Type",
      dataIndex: "customer_type",
      width: 100,
      render: (t) => types.find((x) => x.value === t)?.label ?? t,
    },
    {
      title: "Due balance",
      dataIndex: "current_balance",
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
            title="Delete this customer?"
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

  return (
    <PageShell
      title="Customer management"
      description="CRM-lite: contact details, branch scope, credit and loyalty fields, plus sales ledger, amounts due, and payment history."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Parties" }, { title: "Customers" }]}
    >
      <Card
        bordered={false}
        className="ims-card"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
            Add customer
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
        title={editing ? "Edit customer" : "Add customer"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        footer={null}
        destroyOnClose
        width={560}
      >
        <Form
          layout="vertical"
          key={editing?.id ?? `new-${branchId ?? "nobranch"}`}
          initialValues={
            editing
              ? {
                  ...editing,
                  branch_ids: editing.branches?.map((b) => b.id) ?? [],
                  opening_balance: decimalFormValue(editing.opening_balance),
                  credit_limit: decimalFormValue(editing.credit_limit),
                  current_balance: decimalFormValue(editing.current_balance),
                  reward_points: intFormValue(editing.reward_points),
                }
              : { ...empty, branch_ids: branchId ? [branchId] : [] }
          }
          onFinish={(values) => {
            const payload = {
              name: values.name,
              phone: values.phone ?? "",
              email: values.email ?? "",
              address: values.address ?? "",
              customer_type: values.customer_type ?? "retail",
              opening_balance: decimalFormValue(values.opening_balance),
              credit_limit: decimalFormValue(values.credit_limit),
              reward_points: intFormValue(values.reward_points),
              branch_ids: values.branch_ids ?? [],
            };
            if (editing?.id) {
              payload.current_balance = decimalFormValue(values.current_balance);
            }
            saveMut.mutate({ id: editing?.id, values: payload });
          }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="Customer name" />
          </Form.Item>
          <Form.Item
            name="branch_ids"
            label="Branches"
            rules={[{ required: true, type: "array", min: 1, message: "Select at least one branch" }]}
          >
            <Select
              mode="multiple"
              allowClear
              placeholder={branchesQ.isLoading ? "Loading branches…" : "Where this customer can shop"}
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
            <Input placeholder="name@example.com" />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} placeholder="Street, city, country" />
          </Form.Item>
          <Form.Item name="customer_type" label="Customer type">
            <Select options={types} />
          </Form.Item>
          <Form.Item
            name="opening_balance"
            label="Opening balance"
            dependencies={["credit_limit"]}
            extra="Starting amount this customer already owes you before using this system (numbers only). Usually 0."
            rules={[
              { type: "number", min: 0, message: "Enter zero or a positive amount." },
              ({ getFieldValue }) => ({
                validator(_, opening) {
                  const lim = Number(getFieldValue("credit_limit") ?? 0);
                  const ob = Number(opening ?? 0);
                  if (lim > 0 && ob > lim) {
                    return Promise.reject(
                      new Error(
                        "Opening balance cannot be higher than credit limit — raise credit limit or lower this amount.",
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
            extra="Maximum total they may owe on credit. Must be ≥ opening balance if both are above zero. Use 0 for cash-only customers."
            rules={[
              { type: "number", min: 0, message: "Enter zero or a positive amount." },
              ({ getFieldValue }) => ({
                validator(_, creditLim) {
                  const opening = Number(getFieldValue("opening_balance") ?? 0);
                  const lim = Number(creditLim ?? 0);
                  if (lim > 0 && opening > lim) {
                    return Promise.reject(
                      new Error(
                        "Credit limit must be at least equal to opening balance (starting debt cannot exceed the limit).",
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
              label="Current balance (due)"
              dependencies={["credit_limit"]}
              extra="How much they owe right now. Normally updated by sales; change only to fix mistakes. Cannot be higher than credit limit when credit limit is set."
              rules={[
                { type: "number", min: 0, message: "Enter zero or more." },
                ({ getFieldValue }) => ({
                  validator(_, due) {
                    const lim = Number(getFieldValue("credit_limit") ?? 0);
                    const d = Number(due ?? 0);
                    if (lim > 0 && d > lim) {
                      return Promise.reject(
                        new Error("Due amount is above credit limit — raise credit limit or lower due balance."),
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
          <Form.Item name="reward_points" label="Reward points">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saveMut.isPending} block>
            Save
          </Button>
        </Form>
      </Modal>

      <Drawer
        title={customer?.name ?? "Customer"}
        width={720}
        open={detailId != null}
        onClose={() => setDetailId(null)}
        destroyOnClose
      >
        {detailQ.isLoading ? (
          <Typography.Paragraph type="secondary">Loading…</Typography.Paragraph>
        ) : customer ? (
          <>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Name">{customer.name}</Descriptions.Item>
              <Descriptions.Item label="Phone">{customer.phone || "—"}</Descriptions.Item>
              <Descriptions.Item label="Email">{customer.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="Address">{customer.address || "—"}</Descriptions.Item>
              <Descriptions.Item label="Type">
                {types.find((x) => x.value === customer.customer_type)?.label ?? customer.customer_type}
              </Descriptions.Item>
              <Descriptions.Item label="Branches">
                {customer.branches?.length
                  ? customer.branches.map((b) => b.name).join(", ")
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Opening balance">{formatCurrency(customer.opening_balance)}</Descriptions.Item>
              <Descriptions.Item label="Credit limit">{formatCurrency(customer.credit_limit)}</Descriptions.Item>
              <Descriptions.Item label="Due balance (current)">{formatCurrency(customer.current_balance)}</Descriptions.Item>
              <Descriptions.Item label="Reward points">{customer.reward_points ?? 0}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Sales ledger</Divider>
            {ledgerQ.isLoading ? (
              <Typography.Text type="secondary">Loading ledger…</Typography.Text>
            ) : ledger ? (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Space size="large" wrap>
                  <div>
                    <Typography.Text type="secondary">Orders (non-cancelled)</Typography.Text>
                    <div>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {ledger.sale_count ?? 0}
                      </Typography.Title>
                    </div>
                  </div>
                  <div>
                    <Typography.Text type="secondary">Total sales</Typography.Text>
                    <div>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {formatCurrency(ledger.total_sales)}
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
                    <Typography.Text type="secondary">Due on orders</Typography.Text>
                    <div>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {formatCurrency(ledger.due_amount)}
                      </Typography.Title>
                    </div>
                  </div>
                  <div>
                    <Typography.Text type="secondary">Outstanding (record)</Typography.Text>
                    <div>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {formatCurrency(ledger.current_balance)}
                      </Typography.Title>
                    </div>
                  </div>
                </Space>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  Totals sum POS sales in branches you can access (excluding cancelled). Outstanding matches the
                  customer&apos;s stored running balance.
                </Typography.Paragraph>
              </Card>
            ) : null}

            <Divider orientation="left">Purchase history</Divider>
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
              Recent sales (invoices) for this customer.
            </Typography.Paragraph>
            <Table
              size="small"
              rowKey="id"
              loading={historyQ.isLoading}
              dataSource={sales}
              columns={saleColumns}
              pagination={false}
            />

            <Divider orientation="left">Payment history</Divider>
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
              Individual payments from split tenders or the primary tender on each sale.
            </Typography.Paragraph>
            <Table
              size="small"
              rowKey="key"
              loading={paymentsQ.isLoading}
              dataSource={payments.map((row, index) => ({
                ...row,
                key: `${row.invoice_number}-${row.sale_date}-${index}`,
              }))}
              columns={paymentColumns}
              pagination={false}
            />

            <Space style={{ marginTop: 16 }}>
              <Button
                type="primary"
                onClick={() => {
                  setDetailId(null);
                  openEdit(customer);
                }}
              >
                Edit customer
              </Button>
              <ConfirmDeleteButton
                title="Delete this customer?"
                onConfirm={() => delMut.mutateAsync(customer.id)}
                disabled={delMut.isPending}
              >
                Delete customer
              </ConfirmDeleteButton>
            </Space>
          </>
        ) : (
          <Typography.Text type="danger">Could not load customer.</Typography.Text>
        )}
      </Drawer>
    </PageShell>
  );
}
