import { App, Button, Card, Form, Input, Modal, Space, Table, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, TagsOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrand, deleteBrand, listBrands, updateBrand } from "../../api/products.js";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton.jsx";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { applyDrfFieldErrors, envelopeMessage } from "../../utils/apiErrors.js";
import { antServerPagination } from "../../utils/serverPagination.js";

export function BrandsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const brandsQ = useQuery({
    queryKey: ["brands", page, pageSize],
    queryFn: () => listBrands({ page, page_size: pageSize }),
  });

  const saveMut = useMutation({
    mutationFn: ({ id, values }) => (id ? updateBrand(id, values) : createBrand(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      message.success(editing ? "Brand updated." : "Brand created.");
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (e) => {
      if (!applyDrfFieldErrors(form, e)) message.error(envelopeMessage(e));
    },
  });

  const delMut = useMutation({
    mutationFn: deleteBrand,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["brands"], refetchType: "all" });
      message.success("Brand deleted.");
    },
    onError: (e) => message.error(envelopeMessage(e)),
  });

  const rows = brandsQ.data?.results ?? [];
  const total = brandsQ.data?.count ?? 0;

  return (
    <PageShell
      title="Brand management"
      description="Create and manage product brands so products can be linked correctly."
      breadcrumb={[
        { title: "Home", path: "/" },
        { title: "Catalog", path: "/products" },
        { title: "Brands" },
      ]}
    >
      <Card
        bordered={false}
        className="ims-card"
        title={
          <Space>
            <TagsOutlined />
            <span>Brands</span>
            <Typography.Text type="secondary">({total})</Typography.Text>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setModalOpen(true);
            }}
          >
            Add brand
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={brandsQ.isLoading}
          dataSource={rows}
          columns={[
            { title: "Name", dataIndex: "name", key: "name" },
            {
              title: "Actions",
              key: "a",
              width: 160,
              render: (_, r) => (
                <Space>
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditing(r);
                      form.setFieldsValue({ name: r.name });
                      setModalOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <ConfirmDeleteButton
                    title="Delete this brand?"
                    description="Products linked to this brand must be reassigned first."
                    onConfirm={() => delMut.mutateAsync(r.id)}
                    icon={<DeleteOutlined />}
                    loading={delMut.isPending}
                  >
                    Delete
                  </ConfirmDeleteButton>
                </Space>
              ),
            },
          ]}
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
        title={editing ? "Edit brand" : "Add brand"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        okText={editing ? "Save" : "Create"}
        onOk={() => form.submit()}
        confirmLoading={saveMut.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 12 }}
          onFinish={(values) => {
            const payload = { name: (values.name || "").trim() };
            saveMut.mutate({ id: editing?.id, values: payload });
          }}
        >
          <Form.Item
            name="name"
            label="Brand name"
            rules={[{ required: true, whitespace: true, message: "Enter a brand name" }]}
          >
            <Input placeholder="e.g. Samsung, Apple, Nike" />
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}
