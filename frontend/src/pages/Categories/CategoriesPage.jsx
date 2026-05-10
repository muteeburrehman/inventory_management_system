import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Table,
  TreeSelect,
  Typography,
} from "antd";
import { EditOutlined, FolderOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  deleteCategory,
  fetchCategoryTree,
  updateCategory,
} from "../../api/products.js";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton.jsx";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { envelopeMessage } from "../../utils/apiErrors.js";
import { applyDrfFieldErrors } from "../../utils/apiErrors.js";

/** Collect this node + all descendants' ids (for parent picker: cannot re-parent under self). */
function collectSubtreeIds(node) {
  const ids = new Set([node.id]);
  for (const c of node.children || []) {
    for (const x of collectSubtreeIds(c)) {
      ids.add(x);
    }
  }
  return ids;
}

function collectIdsFromTree(tree) {
  const ids = new Set();
  function walk(nodes) {
    for (const n of nodes || []) {
      ids.add(n.id);
      walk(n.children);
    }
  }
  walk(tree);
  return ids;
}

function findNodeById(tree, id) {
  for (const n of tree || []) {
    if (n.id === id) return n;
    const hit = findNodeById(n.children, id);
    if (hit) return hit;
  }
  return null;
}

function subtreeIdsFromTree(tree, targetId) {
  const node = findNodeById(tree, targetId);
  if (!node) return new Set();
  return collectSubtreeIds(node);
}

function toTreeSelectData(tree, disabledIds) {
  return (tree || []).map((n) => ({
    title: n.name,
    value: n.id,
    key: n.id,
    disabled: disabledIds.has(n.id),
    children: n.children?.length ? toTreeSelectData(n.children, disabledIds) : undefined,
  }));
}

export function CategoriesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [presetParentId, setPresetParentId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { data: tree = [], isLoading } = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: fetchCategoryTree,
  });

  const forbiddenParentIds = useMemo(() => {
    if (!editingId) return new Set();
    return subtreeIdsFromTree(tree, editingId);
  }, [editingId, tree]);

  const parentTreeData = useMemo(
    () => toTreeSelectData(tree, forbiddenParentIds),
    [tree, forbiddenParentIds]
  );

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
      message.success("Category created.");
      closeModal();
    },
    onError: (err) => {
      if (!applyDrfFieldErrors(form, err)) message.error(envelopeMessage(err));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => updateCategory(id, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
      message.success("Category updated.");
      closeModal();
    },
    onError: (err) => {
      if (!applyDrfFieldErrors(form, err)) message.error(envelopeMessage(err));
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onMutate: (id) => {
      setDeletingId(id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
      message.success("Category deleted.");
    },
    onError: (err) => {
      const payload = err?.response?.data;
      const nonField = payload?.errors?.non_field_errors;
      const detail = Array.isArray(nonField) && nonField.length ? nonField[0] : null;
      message.error(detail || envelopeMessage(err));
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setPresetParentId(null);
    form.resetFields();
  };

  const openCreate = (parentId = null) => {
    setEditingId(null);
    setPresetParentId(parentId);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingId(record.id);
    setPresetParentId(null);
    form.setFieldsValue({
      name: record.name,
      parent: record.parent_id ?? undefined,
    });
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen || editingId) return;
    if (presetParentId != null) {
      form.setFieldsValue({ parent: presetParentId });
    } else {
      form.setFieldsValue({ parent: undefined });
    }
  }, [modalOpen, editingId, presetParentId, form]);

  const onSubmit = () => {
    form.validateFields().then((values) => {
      const name = (values.name || "").trim();
      const parent = values.parent ?? null;
      const body = { name, parent };
      if (editingId) updateMut.mutate({ id: editingId, body });
      else createMut.mutate(body);
    });
  };

  const allIds = useMemo(() => collectIdsFromTree(tree), [tree]);

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
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
      width: 280,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openCreate(record.id)}>
            Add subcategory
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            Edit
          </Button>
          <ConfirmDeleteButton
            title="Delete this category?"
            description="Must have no subcategories and no linked products."
            onConfirm={() => deleteMut.mutateAsync(record.id)}
            icon={<DeleteOutlined />}
            loading={deletingId === record.id}
          >
            Delete
          </ConfirmDeleteButton>
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title="Category management"
      description="Main categories, subcategories, and deeper nesting (e.g. Electronics › Mobile / Laptop)."
      breadcrumb={[
        { title: "Home", path: "/" },
        { title: "Catalog", path: "/products" },
        { title: "Categories" },
      ]}
    >
      <Card
        bordered={false}
        className="ims-card"
        title={
          <Space>
            <FolderOutlined />
            <span>Category tree</span>
            <Typography.Text type="secondary">({allIds.size})</Typography.Text>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(null)}>
            Add main category
          </Button>
        }
      >
        <Typography.Paragraph type="secondary">
          Use <strong>Add main category</strong> for a top-level group (e.g. Electronics). Use{" "}
          <strong>Add subcategory</strong> on a row to nest (e.g. Mobile, Laptop under Electronics).
        </Typography.Paragraph>
        <Table
          rowKey="id"
          loading={isLoading}
          pagination={false}
          columns={columns}
          dataSource={tree}
          expandable={{ defaultExpandAllRows: true }}
        />
      </Card>

      <Modal
        title={editingId ? "Edit category" : "Add category"}
        open={modalOpen}
        onCancel={closeModal}
        destroyOnClose
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText={editingId ? "Save" : "Create"}
        onOk={onSubmit}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, whitespace: true, message: "Enter a category name" }]}
          >
            <Input placeholder="e.g. Electronics, Mobile, Laptop" />
          </Form.Item>
          <Form.Item name="parent" label="Parent category">
            <TreeSelect
              allowClear
              placeholder="None — main (root) category"
              treeData={parentTreeData}
              treeDefaultExpandAll
              showSearch
              treeNodeFilterProp="title"
              style={{ width: "100%" }}
            />
          </Form.Item>
          {presetParentId != null && editingId == null && (
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              Creating under the selected parent. Clear &quot;Parent category&quot; above to make a root category
              instead.
            </Typography.Text>
          )}
        </Form>
      </Modal>
    </PageShell>
  );
}
