import { useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  deleteExpenseCategory,
  listExpenseCategories,
  listExpenses,
  updateExpense,
  updateExpenseCategory,
} from "../../api/expenses.js";
import { listBranches } from "../../api/settings.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

export function ExpensesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [expModal, setExpModal] = useState(false);
  const [catModal, setCatModal] = useState(false);
  const [editingExp, setEditingExp] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [expForm] = Form.useForm();
  const [catForm] = Form.useForm();

  const [expPage, setExpPage] = useState(1);
  const [expPageSize, setExpPageSize] = useState(25);
  const [catPage, setCatPage] = useState(1);
  const [catPageSize, setCatPageSize] = useState(25);

  const catQ = useQuery({
    queryKey: ["expense-categories", catPage, catPageSize],
    queryFn: () => listExpenseCategories({ page: catPage, page_size: catPageSize }),
  });
  const expQ = useQuery({
    queryKey: ["expenses", expPage, expPageSize],
    queryFn: () => listExpenses({ page: expPage, page_size: expPageSize }),
  });
  const catLabelQ = useQuery({
    queryKey: ["expense-categories", "labels"],
    queryFn: () => listExpenseCategories({ page: 1, page_size: 100 }),
  });
  const brLabelQ = useQuery({
    queryKey: ["branches", "expense-labels"],
    queryFn: () => listBranches({ page: 1, page_size: 100 }),
  });

  const saveCat = useMutation({
    mutationFn: ({ id, values }) => (id ? updateExpenseCategory(id, values) : createExpenseCategory(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      message.success(editingCat ? "Category updated." : "Category added.");
      setCatModal(false);
      setEditingCat(null);
      catForm.resetFields();
    },
    onError: (e) => message.error(e?.response?.data?.message || "Save failed."),
  });

  const delCat = useMutation({
    mutationFn: deleteExpenseCategory,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense-categories"], refetchType: "all" });
      message.success("Category removed.");
    },
    onError: () => message.error("Delete failed — category may be in use."),
  });

  const saveExp = useMutation({
    mutationFn: ({ id, values }) => (id ? updateExpense(id, values) : createExpense(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      message.success(editingExp ? "Expense updated." : "Expense recorded.");
      setExpModal(false);
      setEditingExp(null);
      expForm.resetFields();
    },
    onError: (e) => message.error(e?.response?.data?.message || "Save failed."),
  });

  const catById = useMemo(
    () => Object.fromEntries((catLabelQ.data?.results ?? []).map((c) => [c.id, c.name])),
    [catLabelQ.data],
  );
  const brById = useMemo(
    () => Object.fromEntries((brLabelQ.data?.results ?? []).map((b) => [b.id, b.name])),
    [brLabelQ.data],
  );

  const delExp = useMutation({
    mutationFn: deleteExpense,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expenses"], refetchType: "all" });
      message.success("Expense deleted.");
    },
    onError: () => message.error("Delete failed."),
  });

  const catCols = [
    { title: "Name", dataIndex: "name", key: "n" },
    {
      title: "Actions",
      key: "a",
      width: 100,
      render: (_, r) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingCat(r);
              catForm.setFieldsValue(r);
              setCatModal(true);
            }}
          />
          <Popconfirm title="Delete category?" onConfirm={() => delCat.mutateAsync(r.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const expCols = [
    {
      title: "Date",
      dataIndex: "date",
      key: "d",
      width: 110,
    },
    {
      title: "Category",
      key: "c",
      render: (_, r) => catById[r.category] ?? r.category ?? "—",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "a",
      width: 120,
      render: (v) => formatCurrency(v),
    },
    { title: "Mode", dataIndex: "payment_mode", key: "m", width: 90 },
    {
      title: "Branch",
      key: "b",
      width: 120,
      render: (_, r) => brById[r.branch] ?? r.branch ?? "—",
    },
    {
      title: "Actions",
      key: "x",
      width: 100,
      render: (_, r) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingExp(r);
              expForm.setFieldsValue({
                ...r,
                category: r.category?.id ?? r.category,
                branch: r.branch?.id ?? r.branch,
                date: r.date ? dayjs(r.date) : null,
              });
              setExpModal(true);
            }}
          />
          <Popconfirm title="Delete expense?" onConfirm={() => delExp.mutateAsync(r.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: "exp",
      label: "Expenses",
      children: (
        <Card
          bordered={false}
          className="ims-card"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingExp(null);
                expForm.resetFields();
                setExpModal(true);
              }}
            >
              Add expense
            </Button>
          }
        >
          <Table
            rowKey="id"
            loading={expQ.isLoading}
            columns={expCols}
            dataSource={expQ.data?.results ?? []}
            pagination={antServerPagination({
              page: expPage,
              pageSize: expPageSize,
              total: expQ.data?.count ?? 0,
              onChange: (p, ps) => {
                setExpPage(p);
                setExpPageSize(ps);
              },
            })}
          />
        </Card>
      ),
    },
    {
      key: "cat",
      label: "Categories",
      children: (
        <Card
          bordered={false}
          className="ims-card"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingCat(null);
                catForm.resetFields();
                setCatModal(true);
              }}
            >
              Add category
            </Button>
          }
        >
          <Table
            rowKey="id"
            loading={catQ.isLoading}
            columns={catCols}
            dataSource={catQ.data?.results ?? []}
            pagination={antServerPagination({
              page: catPage,
              pageSize: catPageSize,
              total: catQ.data?.count ?? 0,
              onChange: (p, ps) => {
                setCatPage(p);
                setCatPageSize(ps);
              },
            })}
          />
        </Card>
      ),
    },
  ];

  return (
    <PageShell
      title="Expenses"
      description="Operating expenses with categories and ledger linkage (PRD §13)."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Finance" }, { title: "Expenses" }]}
    >
      <Tabs items={tabItems} />

      <Modal
        title={editingExp ? "Edit expense" : "New expense"}
        open={expModal}
        onCancel={() => {
          setExpModal(false);
          setEditingExp(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          layout="vertical"
          form={expForm}
          onFinish={(v) => {
            const payload = {
              category: v.category,
              amount: v.amount,
              description: v.description || "",
              date: v.date ? v.date.format("YYYY-MM-DD") : undefined,
              payment_mode: v.payment_mode || "cash",
              branch: v.branch,
            };
            saveExp.mutate({ id: editingExp?.id, values: payload });
          }}
        >
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select
              options={(catLabelQ.data?.results ?? []).map((c) => ({ value: c.id, label: c.name }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="branch" label="Branch" rules={[{ required: true }]}>
            <Select options={(brLabelQ.data?.results ?? []).map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="payment_mode" label="Payment mode" initialValue="cash">
            <Select
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank", label: "Bank" },
                { value: "card", label: "Card" },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saveExp.isPending}>
            Save
          </Button>
        </Form>
      </Modal>

      <Modal
        title={editingCat ? "Edit category" : "New category"}
        open={catModal}
        onCancel={() => {
          setCatModal(false);
          setEditingCat(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={catForm} layout="vertical" onFinish={(values) => saveCat.mutate({ id: editingCat?.id, values })}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saveCat.isPending}>
            Save
          </Button>
        </Form>
      </Modal>
    </PageShell>
  );
}
