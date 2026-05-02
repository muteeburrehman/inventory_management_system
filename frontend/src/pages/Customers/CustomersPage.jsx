import { useState } from "react";
import {
  App,
  Button,
  Card,
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
import { createCustomer, deleteCustomer, listCustomers, updateCustomer } from "../../api/customers.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
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
  current_balance: 0,
  reward_points: 0,
};

export function CustomersPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["customers", page, pageSize],
    queryFn: () => listCustomers({ page, page_size: pageSize }),
  });
  const rows = pageData?.results ?? [];
  const total = pageData?.count ?? 0;

  const saveMut = useMutation({
    mutationFn: ({ id, values }) => (id ? updateCustomer(id, values) : createCustomer(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      message.success(editing ? "Customer updated." : "Customer created.");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e) => message.error(e?.response?.data?.message || "Save failed."),
  });

  const delMut = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["customers"], refetchType: "all" });
      message.success("Deleted.");
    },
    onError: (e) => message.error(e?.response?.data?.message || "Delete failed."),
  });

  const columns = [
    { title: "Name", dataIndex: "name" },
    { title: "Phone", dataIndex: "phone", width: 120 },
    { title: "Email", dataIndex: "email", ellipsis: true },
    {
      title: "Type",
      dataIndex: "customer_type",
      width: 110,
      render: (t) => types.find((x) => x.value === t)?.label ?? t,
    },
    {
      title: "Balance",
      dataIndex: "current_balance",
      width: 120,
      render: (v) => formatCurrency(v),
    },
    {
      title: "Points",
      dataIndex: "reward_points",
      width: 80,
    },
    {
      title: "Actions",
      key: "act",
      width: 140,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); setModalOpen(true); }} />
          <Popconfirm title="Delete customer?" onConfirm={() => delMut.mutateAsync(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title="Customers"
      description="Customer types, credit limits, and balances. Ledger statements link from row actions in a later iteration (PRD §5)."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Parties" }, { title: "Customers" }]}
    >
      <Card
        bordered={false}
        className="ims-card"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Add customer
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={rows}
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
        title={editing ? "Edit customer" : "New customer"}
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
          key={editing?.id ?? "new"}
          initialValues={editing ? { ...editing } : { ...empty }}
          onFinish={(values) => {
            const payload = { ...values };
            delete payload.id;
            saveMut.mutate({ id: editing?.id, values: payload });
          }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="customer_type" label="Customer type">
            <Select options={types} />
          </Form.Item>
          <Form.Item name="opening_balance" label="Opening balance">
            <InputNumber min={0} style={{ width: "100%" }} step={0.01} />
          </Form.Item>
          <Form.Item name="credit_limit" label="Credit limit">
            <InputNumber min={0} style={{ width: "100%" }} step={0.01} />
          </Form.Item>
          {editing && (
            <Form.Item name="current_balance" label="Current balance">
              <InputNumber style={{ width: "100%" }} step={0.01} />
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
    </PageShell>
  );
}
