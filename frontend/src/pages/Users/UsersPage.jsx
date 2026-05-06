import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  deleteUser,
  listPermissions,
  listUsers,
  updatePermissions,
  updateUser,
} from "../../api/users.js";
import { listBranches } from "../../api/settings.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { antServerPagination } from "../../utils/serverPagination.js";
import { applyDrfFieldErrors, envelopeMessage } from "../../utils/apiErrors.js";

const ROLES = [
  { value: "super_admin", label: "Super admin" },
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "accountant", label: "Accountant" },
  { value: "inventory_manager", label: "Inventory manager" },
  { value: "sales_staff", label: "Sales staff" },
];

export function UsersPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const sendInvite = Form.useWatch("send_invite", form);
  const [permRows, setPermRows] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(25);

  const usersQ = useQuery({
    queryKey: ["users", userPage, userPageSize],
    queryFn: () => listUsers({ page: userPage, page_size: userPageSize }),
    retry: false,
  });
  const branchesQ = useQuery({
    queryKey: ["branches", "all-options"],
    queryFn: () => listBranches({ page: 1, page_size: 100 }),
  });
  const permQ = useQuery({
    queryKey: ["permissions"],
    queryFn: () => listPermissions(),
    retry: false,
  });

  useEffect(() => {
    const r = permQ.data?.results ?? [];
    if (r.length) {
      setPermRows(r.map((p) => ({ ...p })));
    }
  }, [permQ.data]);

  const saveUser = useMutation({
    mutationFn: ({ id, values }) => (id ? updateUser(id, values) : createUser(values)),
    onSuccess: (created, variables) => {
      const wasEdit = Boolean(variables?.id);
      qc.invalidateQueries({ queryKey: ["users"] });
      message.success(wasEdit ? "User updated." : "User created.");
      if (!wasEdit && created?.invite_url) {
        Modal.success({
          title: "Invitation link",
          content: (
            <Typography.Paragraph copyable style={{ wordBreak: "break-all" }}>
              {created.invite_url}
            </Typography.Paragraph>
          ),
        });
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (e) => {
      if (!applyDrfFieldErrors(form, e)) {
        message.error(envelopeMessage(e));
      }
    },
  });

  const delUser = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"], refetchType: "all" });
      message.success("User removed.");
    },
    onError: (e) => message.error(e?.response?.data?.message || "Delete failed."),
  });

  const savePerm = useMutation({
    mutationFn: () =>
      updatePermissions(
        permRows.map((r) => ({
          id: r.id,
          can_create: r.can_create,
          can_edit: r.can_edit,
          can_delete: r.can_delete,
          can_print: r.can_print,
          can_refund: r.can_refund,
          can_view_reports: r.can_view_reports,
        })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permissions"] });
      message.success("Permissions saved.");
    },
    onError: (e) => message.error(e?.response?.data?.message || "Could not save permissions."),
  });

  const usersForbidden = usersQ.error?.response?.status === 403;
  const permForbidden = permQ.error?.response?.status === 403;

  const userRows = usersQ.data?.results ?? [];
  const userTotal = usersQ.data?.count ?? 0;
  const branchOptions = (branchesQ.data?.results ?? []).map((b) => ({ value: b.id, label: b.name }));

  const openNew = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    form.setFieldsValue({
      username: row.username,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role,
      branch_ids: (row.branches ?? []).map((b) => b.id),
      phone: row.phone,
      password: "",
      send_invite: false,
    });
    setModalOpen(true);
  };

  const onFinish = (values) => {
    const body = { ...values };
    if (!body.password) delete body.password;
    if (editing) {
      const { password, send_invite: _s, ...rest } = body;
      const payload = password ? { ...rest, password } : rest;
      saveUser.mutate({ id: editing.id, values: payload });
    } else {
      if (body.send_invite) {
        delete body.password;
      } else if (!body.password) {
        message.warning("Set a password or enable “Send email invitation”.");
        return;
      }
      saveUser.mutate({ values: body });
    }
  };

  const patchPerm = (id, key, val) => {
    setPermRows((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  };

  const userCols = [
    { title: "Username", dataIndex: "username", key: "u" },
    { title: "Email", dataIndex: "email", key: "e", ellipsis: true },
    { title: "Role", dataIndex: "role", key: "r", width: 140 },
    {
      title: "Branches",
      key: "b",
      render: (_, r) => (r.branches?.length ? r.branches.map((x) => x.name).join(", ") : r.branch?.name ?? "—"),
    },
    {
      title: "Actions",
      key: "a",
      width: 120,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete user?" onConfirm={() => delUser.mutateAsync(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const permCols = [
    { title: "Role", dataIndex: "role", width: 120 },
    { title: "Module", dataIndex: "module", width: 140 },
    {
      title: "Create",
      key: "c",
      render: (_, r) => <Switch size="small" checked={r.can_create} onChange={(v) => patchPerm(r.id, "can_create", v)} />,
    },
    {
      title: "Edit",
      key: "ed",
      render: (_, r) => <Switch size="small" checked={r.can_edit} onChange={(v) => patchPerm(r.id, "can_edit", v)} />,
    },
    {
      title: "Delete",
      key: "del",
      render: (_, r) => <Switch size="small" checked={r.can_delete} onChange={(v) => patchPerm(r.id, "can_delete", v)} />,
    },
    {
      title: "Print",
      key: "p",
      render: (_, r) => <Switch size="small" checked={r.can_print} onChange={(v) => patchPerm(r.id, "can_print", v)} />,
    },
    {
      title: "Refund",
      key: "ref",
      render: (_, r) => <Switch size="small" checked={r.can_refund} onChange={(v) => patchPerm(r.id, "can_refund", v)} />,
    },
    {
      title: "Reports",
      key: "rep",
      render: (_, r) => (
        <Switch size="small" checked={r.can_view_reports} onChange={(v) => patchPerm(r.id, "can_view_reports", v)} />
      ),
    },
  ];

  const tabItems = [
    {
      key: "users",
      label: "Users",
      children: (
        <>
          {usersForbidden && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Only super admin and owner can manage staff, invitations, and role permissions."
            />
          )}
          <Card
            bordered={false}
            className="ims-card"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={openNew} disabled={usersForbidden}>
                Add user
              </Button>
            }
          >
            <Table
              rowKey="id"
              loading={usersQ.isLoading}
              columns={userCols}
              dataSource={userRows}
              pagination={antServerPagination({
                page: userPage,
                pageSize: userPageSize,
                total: userTotal,
                onChange: (p, ps) => {
                  setUserPage(p);
                  setUserPageSize(ps);
                },
              })}
            />
          </Card>
        </>
      ),
    },
    {
      key: "perm",
      label: "Role permissions",
      children: (
        <>
          {permForbidden && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="You need super admin or owner access to change role permissions."
            />
          )}
          <Card
            bordered={false}
            className="ims-card"
            extra={
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={savePerm.isPending}
                disabled={permForbidden || !permRows.length}
                onClick={() => savePerm.mutate()}
              >
                Save permissions
              </Button>
            }
          >
            <Table
              rowKey="id"
              size="small"
              loading={permQ.isLoading}
              columns={permCols}
              dataSource={permRows}
              scroll={{ x: 900 }}
              pagination={false}
            />
          </Card>
        </>
      ),
    },
  ];

  return (
    <PageShell
      title="Users & permissions"
      description="Staff accounts, branches, and per-module capabilities (PRD §14)."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Administration" }, { title: "Users" }]}
    >
      <Tabs items={tabItems} />

      <Modal
        title={editing ? "Edit user" : "New user"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        footer={null}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input autoComplete="off" disabled={!!editing} />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              {
                validator: (_, v) => {
                  const s = (v ?? "").trim();
                  if (!s) return Promise.resolve();
                  if (/^\S+@\S+\.\S+$/.test(s)) return Promise.resolve();
                  return Promise.reject(new Error("Enter a valid email"));
                },
              },
            ]}
          >
            <Input />
          </Form.Item>
          {!editing && (
            <Form.Item
              name="send_invite"
              label="Send email invitation"
              valuePropName="checked"
              initialValue={false}
              extra="When on, the user sets their password via the email link — no password needed here."
            >
              <Switch
                checkedChildren="On"
                unCheckedChildren="Off"
                onChange={(on) => {
                  if (on) form.setFieldValue("password", "");
                }}
              />
            </Form.Item>
          )}
          <Form.Item
            name="password"
            label={editing ? "New password (optional)" : "Password (if not inviting)"}
            extra={
              !editing && sendInvite ? "Disabled while invitation is enabled." : undefined
            }
          >
            <Input.Password
              autoComplete="new-password"
              disabled={!editing && !!sendInvite}
              placeholder={!editing && sendInvite ? "Invitation email will include setup link" : undefined}
            />
          </Form.Item>
          <Form.Item name="first_name" label="First name">
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Last name">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={ROLES} />
          </Form.Item>
          <Form.Item name="branch_ids" label="Branch access" rules={[{ required: true, message: "Select at least one branch" }]}>
            <Select mode="multiple" placeholder="Branches" options={branchOptions} />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saveUser.isPending}>
            Save
          </Button>
        </Form>
      </Modal>
    </PageShell>
  );
}
