import { useState } from "react";
import { App, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createCoupon, deleteCoupon, listCoupons, updateCoupon } from "../../api/coupons.js";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton.jsx";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { antServerPagination } from "../../utils/serverPagination.js";

export function CouponsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const listQ = useQuery({
    queryKey: ["coupons", page, pageSize],
    queryFn: () => listCoupons({ page, page_size: pageSize }),
  });

  const saveMut = useMutation({
    mutationFn: ({ id, values }) => {
      const body = {
        ...values,
        expiry_date: values.expiry_date.format("YYYY-MM-DD"),
        discount_value: String(values.discount_value),
        min_order_value: String(values.min_order_value ?? 0),
      };
      return id ? updateCoupon(id, body) : createCoupon(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      message.success(editing ? "Coupon updated." : "Coupon created.");
      setOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (e) => message.error(e?.response?.data?.message || "Save failed."),
  });

  const openNew = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      discount_type: "percent",
      min_order_value: 0,
      is_active: true,
      expiry_date: dayjs().add(30, "day"),
    });
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    form.setFieldsValue({
      code: row.code,
      discount_type: row.discount_type,
      discount_value: Number(row.discount_value),
      min_order_value: Number(row.min_order_value),
      expiry_date: dayjs(row.expiry_date),
      is_active: row.is_active,
    });
    setOpen(true);
  };

  const columns = [
    { title: "Code", dataIndex: "code" },
    { title: "Type", dataIndex: "discount_type", width: 90 },
    { title: "Value", dataIndex: "discount_value", width: 90 },
    { title: "Min order", dataIndex: "min_order_value", width: 100 },
    { title: "Expires", dataIndex: "expiry_date", width: 110 },
    {
      title: "Active",
      dataIndex: "is_active",
      width: 80,
      render: (v) => (v ? "Yes" : "No"),
    },
    {
      title: "",
      key: "act",
      render: (_, r) => (
        <Space>
          <Button type="link" onClick={() => openEdit(r)}>
            Edit
          </Button>
          <ConfirmDeleteButton
            onConfirm={async () => {
              await deleteCoupon(r.id);
              qc.invalidateQueries({ queryKey: ["coupons"] });
              message.success("Deleted.");
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title="Coupons & promotions"
      description="Manage coupon codes used at POS checkout."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Sales" }, { title: "Coupons" }]}
    >
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
          Add coupon
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={listQ.isLoading}
        columns={columns}
        dataSource={listQ.data?.results ?? []}
        pagination={antServerPagination({
          page,
          pageSize,
          total: listQ.data?.count ?? 0,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        })}
      />
      <Modal
        title={editing ? "Edit coupon" : "New coupon"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMut.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => saveMut.mutate({ id: editing?.id, values })}
        >
          <Form.Item name="code" label="Code" rules={[{ required: true }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="discount_type" label="Type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "percent", label: "Percent" },
                { value: "fixed", label: "Fixed amount" },
              ]}
            />
          </Form.Item>
          <Form.Item name="discount_value" label="Value" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="min_order_value" label="Minimum order">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="expiry_date" label="Expiry" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}
