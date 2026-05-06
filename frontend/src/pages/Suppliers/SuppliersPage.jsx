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
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier } from "../../api/suppliers.js";
import { listBranches } from "../../api/settings.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { useAuthStore } from "../../store/authStore.js";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

const empty = {
  name: "",
  company_name: "",
  phone: "",
  email: "",
  address: "",
  tax_number: "",
  opening_balance: 0,
  credit_limit: 0,
  current_balance: 0,
  branch_ids: [],
};

export function SuppliersPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const branchId = useAuthStore((s) => s.user?.branch?.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["suppliers", branchId, page, pageSize],
    queryFn: () => listSuppliers({ page, page_size: pageSize }),
  });
  const branchesQ = useQuery({
    queryKey: ["branches", "suppliers-form"],
    queryFn: () => listBranches({ page_size: 100 }),
    enabled: modalOpen,
  });
  const rows = pageData?.results ?? [];
  const total = pageData?.count ?? 0;

  const saveMut = useMutation({
    mutationFn: ({ id, values }) => (id ? updateSupplier(id, values) : createSupplier(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      message.success(editing ? "Supplier updated." : "Supplier created.");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e) => message.error(e?.response?.data?.message || "Save failed."),
  });

  const delMut = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: async () => {
      // refetchType "all": Popconfirm close can briefly drop observers; "active" alone may skip refetch.
      await qc.invalidateQueries({ queryKey: ["suppliers"], refetchType: "all" });
      message.success("Deleted.");
    },
    onError: (e) => message.error(e?.response?.data?.message || "Delete failed."),
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
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Company", dataIndex: "company_name", key: "company", ellipsis: true },
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
      width: 140,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this supplier?" onConfirm={() => delMut.mutateAsync(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title="Suppliers"
      description="Vendors linked to the branch selected in the header appear here. Edit a supplier to attach or remove branches."
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
        title={editing ? "Edit supplier" : "New supplier"}
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
              ? { ...editing, branch_ids: editing.branches?.map((b) => b.id) ?? [] }
              : { ...empty, branch_ids: branchId ? [branchId] : [] }
          }
          onFinish={(values) => {
            const payload = { ...values };
            delete payload.id;
            delete payload.branches;
            saveMut.mutate({ id: editing?.id, values: payload });
          }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
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
          <Form.Item name="company_name" label="Company name">
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
          <Form.Item name="tax_number" label="Tax number">
            <Input />
          </Form.Item>
          <Form.Item name="opening_balance" label="Opening balance">
            <InputNumber min={0} style={{ width: "100%" }} step={0.01} />
          </Form.Item>
          <Form.Item name="credit_limit" label="Credit limit">
            <InputNumber min={0} style={{ width: "100%" }} step={0.01} />
          </Form.Item>
          {editing && (
            <Form.Item name="current_balance" label="Current balance (saved from transactions)">
              <InputNumber min={0} style={{ width: "100%" }} step={0.01} />
            </Form.Item>
          )}
          <Button type="primary" htmlType="submit" loading={saveMut.isPending} block>
            Save
          </Button>
        </Form>
      </Modal>
    </PageShell>
  );
}
