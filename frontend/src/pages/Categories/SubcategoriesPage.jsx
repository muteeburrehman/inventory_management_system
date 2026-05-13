import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../../api/products.js";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton.jsx";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { applyDrfFieldErrors, envelopeMessage } from "../../utils/apiErrors.js";
import { antServerPagination } from "../../utils/serverPagination.js";

export function SubcategoriesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [parentFilter, setParentFilter] = useState(undefined);

  // Top-level categories: used both as the page filter and as the required
  // "Parent category" dropdown inside the modal.
  const rootCategoriesQ = useQuery({
    queryKey: ["categories", "list", "root", "all-for-sub"],
    queryFn: () => listCategories({ level: "root", page_size: 500 }),
  });
  const rootCategories = rootCategoriesQ.data?.results ?? [];

  const rootOptions = useMemo(
    () =>
      rootCategories
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name })),
    [rootCategories],
  );

  // Subcategories list (parent is not null).
  const subQ = useQuery({
    queryKey: ["categories", "list", "sub", page, pageSize, parentFilter ?? "any"],
    queryFn: () =>
      listCategories({
        page,
        page_size: pageSize,
        level: "sub",
        ...(parentFilter ? { parent: parentFilter } : {}),
      }),
  });
  const rows = subQ.data?.results ?? [];
  const total = subQ.data?.count ?? 0;

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    if (parentFilter) form.setFieldsValue({ parent: parentFilter });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      parent: record.parent ?? undefined,
    });
    setModalOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: ({ id, values }) =>
      id ? updateCategory(id, values) : createCategory(values),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
      message.success(editing ? "Sub-category updated." : "Sub-category created.");
      closeModal();
    },
    onError: (err) => {
      if (!applyDrfFieldErrors(form, err)) message.error(envelopeMessage(err));
    },
  });

  const delMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
      message.success("Sub-category deleted.");
    },
    onError: (err) => {
      const payload = err?.response?.data;
      const nonField = payload?.errors?.non_field_errors;
      const detail = Array.isArray(nonField) && nonField.length ? nonField[0] : null;
      message.error(detail || envelopeMessage(err));
    },
  });

  const onSubmit = () => {
    form.validateFields().then((values) => {
      // Brand is intentionally not exposed here — a sub-category inherits its
      // brand context from the parent category. The backend serializer accepts
      // brand: null which keeps the row consistent.
      const body = {
        name: (values.name || "").trim(),
        parent: values.parent,
        brand: null,
      };
      saveMut.mutate({ id: editing?.id, values: body });
    });
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "Parent category",
      dataIndex: "parent_name",
      key: "parent_name",
      width: 220,
      render: (p) => p || <Tag color="warning">missing parent</Tag>,
    },
    {
      title: "Slug",
      dataIndex: "slug",
      key: "slug",
      width: 200,
      ellipsis: true,
    },
    {
      title: "",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            Edit
          </Button>
          <ConfirmDeleteButton
            title="Delete this sub-category?"
            description="Products still linked to it must be moved first."
            onConfirm={() => delMut.mutateAsync(record.id)}
            icon={<DeleteOutlined />}
            loading={delMut.isPending}
          >
            Delete
          </ConfirmDeleteButton>
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title="Sub-categories"
      description="Nested categories — every sub-category must belong to a parent category."
      breadcrumb={[
        { title: "Home", path: "/" },
        { title: "Catalog", path: "/products" },
        { title: "Sub-categories" },
      ]}
    >
      <Card
        bordered={false}
        className="ims-card"
        title={
          <Space>
            <ApartmentOutlined />
            <span>Sub-categories</span>
            <Typography.Text type="secondary">({total})</Typography.Text>
          </Space>
        }
        extra={
          <Space wrap>
            <Select
              allowClear
              placeholder="Filter by parent category"
              style={{ minWidth: 240 }}
              value={parentFilter}
              onChange={(v) => {
                setParentFilter(v);
                setPage(1);
              }}
              options={rootOptions}
              loading={rootCategoriesQ.isLoading}
              showSearch
              optionFilterProp="label"
            />
            <Link to="/categories">
              <Button>Manage categories →</Button>
            </Link>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
              disabled={rootOptions.length === 0}
            >
              Add sub-category
            </Button>
          </Space>
        }
      >
        {rootOptions.length === 0 ? (
          <Typography.Paragraph type="warning">
            You need at least one top-level <Link to="/categories">category</Link> before you
            can add sub-categories.
          </Typography.Paragraph>
        ) : (
          <Typography.Paragraph type="secondary">
            Picking a <strong>Parent category</strong> is required. Example: under
            <em> Cold Drinks </em> you can add <em>Bottles</em>, <em>Cans</em>, etc.
          </Typography.Paragraph>
        )}
        <Table
          rowKey="id"
          loading={subQ.isLoading}
          pagination={antServerPagination({
            page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          })}
          columns={columns}
          dataSource={rows}
        />
      </Card>

      <Modal
        title={editing ? "Edit sub-category" : "Add sub-category"}
        open={modalOpen}
        onCancel={closeModal}
        destroyOnClose
        confirmLoading={saveMut.isPending}
        okText={editing ? "Save" : "Create"}
        onOk={onSubmit}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="parent"
            label="Parent category"
            rules={[{ required: true, message: "Pick a parent category" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Choose the parent category"
              options={rootOptions}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="Sub-category name"
            rules={[{ required: true, whitespace: true, message: "Enter a name" }]}
          >
            <Input placeholder="e.g. Bottles, Cans, 500ml" />
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}
