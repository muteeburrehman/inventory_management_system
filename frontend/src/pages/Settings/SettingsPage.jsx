import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Result,
  Row,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Typography,
} from "antd";
import {
  BankOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBranch,
  deleteBranch,
  getBusiness,
  listBranches,
  patchBusiness,
  shiftClose,
  shiftOpen,
  updateBranch,
} from "../../api/settings.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { antServerPagination } from "../../utils/serverPagination.js";
import { applyDrfFieldErrors, envelopeMessage } from "../../utils/apiErrors.js";

export function SettingsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [bizForm] = Form.useForm();
  const [shiftForm] = Form.useForm();
  const [closeForm] = Form.useForm();
  const [branchModal, setBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [brForm] = Form.useForm();

  const [branchPage, setBranchPage] = useState(1);
  const [branchPageSize, setBranchPageSize] = useState(25);

  const bizQ = useQuery({
    queryKey: ["business-settings"],
    queryFn: getBusiness,
    retry: 1,
  });
  const branchesQ = useQuery({
    queryKey: ["branches", branchPage, branchPageSize],
    queryFn: () => listBranches({ page: branchPage, page_size: branchPageSize }),
  });

  useEffect(() => {
    if (bizQ.data) {
      bizForm.setFieldsValue({
        business_name: bizQ.data.business_name,
        tax_percent: Number(bizQ.data.tax_percent),
        currency: (bizQ.data.currency || "PKR").toUpperCase(),
        invoice_template: bizQ.data.invoice_template,
        receipt_template: bizQ.data.receipt_template,
        loyalty_points_per_amount: Number(bizQ.data.loyalty_points_per_amount),
      });
    }
  }, [bizQ.data, bizForm]);

  const saveBiz = useMutation({
    mutationFn: (values) => patchBusiness(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-settings"] });
      message.success("Business settings saved.");
    },
    onError: (e) => {
      applyDrfFieldErrors(bizForm, e);
      message.error(envelopeMessage(e));
    },
  });

  const saveBranch = useMutation({
    mutationFn: ({ id, values }) => (id ? updateBranch(id, values) : createBranch(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      message.success(editingBranch ? "Branch updated." : "Branch created.");
      setBranchModal(false);
      setEditingBranch(null);
      brForm.resetFields();
    },
    onError: (e) => {
      applyDrfFieldErrors(brForm, e);
      message.error(envelopeMessage(e));
    },
  });

  const delBranch = useMutation({
    mutationFn: deleteBranch,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["branches"], refetchType: "all" });
      message.success("Branch deleted.");
    },
    onError: (e) => message.error(envelopeMessage(e)),
  });

  const openShift = useMutation({
    mutationFn: shiftOpen,
    onSuccess: () => message.success("Shift opened."),
    onError: (e) => message.error(envelopeMessage(e)),
  });

  const closeShift = useMutation({
    mutationFn: shiftClose,
    onSuccess: () => message.success("Shift closed."),
    onError: (e) => message.error(envelopeMessage(e)),
  });

  const branchCols = [
    { title: "Name", dataIndex: "name", key: "n" },
    { title: "Phone", dataIndex: "phone", key: "p" },
    {
      title: "Main",
      dataIndex: "is_main",
      key: "m",
      width: 80,
      render: (v) => (v ? "Yes" : "—"),
    },
    {
      title: "Actions",
      key: "a",
      width: 120,
      render: (_, r) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingBranch(r);
              brForm.setFieldsValue({ ...r });
              setBranchModal(true);
            }}
          />
          <Popconfirm title="Delete this branch?" description="Ensure no critical data depends on it." onConfirm={() => delBranch.mutateAsync(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const businessTab = (
    <Card bordered={false} className="ims-card" title={<Space><ShopOutlined /> Business profile</Space>}>
      {bizQ.isError ? (
        <Result
          status="error"
          title="Could not load business settings"
          subTitle={envelopeMessage(bizQ.error)}
          extra={
            <Button type="primary" onClick={() => bizQ.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <Spin spinning={bizQ.isLoading}>
          {bizQ.data?.id && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
              message={
                <span>
                  Linked branch: <strong>{bizQ.data.branch?.name ?? "—"}</strong>. Tax and currency apply to POS and invoices.
                </span>
              }
            />
          )}
          <Form
            layout="vertical"
            form={bizForm}
            onFinish={(v) =>
              saveBiz.mutate({
                business_name: v.business_name?.trim(),
                tax_percent: v.tax_percent,
                currency: (v.currency || "PKR").trim().toUpperCase().slice(0, 10),
                invoice_template: (v.invoice_template || "standard").trim(),
                receipt_template: (v.receipt_template || "thermal").trim(),
                loyalty_points_per_amount: v.loyalty_points_per_amount,
              })
            }
            style={{ maxWidth: 520 }}
            requiredMark="optional"
          >
            <Form.Item
              name="business_name"
              label="Business name"
              rules={[
                { required: true, message: "Enter the legal or trading name." },
                { min: 2, message: "At least 2 characters." },
                { max: 255, message: "Too long." },
              ]}
            >
              <Input placeholder="Acme Traders" autoComplete="organization" />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="tax_percent"
                  label="Tax %"
                  rules={[
                    { required: true, message: "Required" },
                    { type: "number", min: 0, max: 100, message: "0–100" },
                  ]}
                >
                  <InputNumber min={0} max={100} step={0.01} style={{ width: "100%" }} placeholder="0" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="currency"
                  label="Currency code"
                  rules={[
                    { required: true, message: "Required" },
                    { pattern: /^[A-Za-z]{3,10}$/, message: "Letters only, e.g. PKR, USD" },
                  ]}
                  normalize={(v) => (v || "").toUpperCase()}
                >
                  <Input placeholder="PKR" maxLength={10} style={{ textTransform: "uppercase" }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="invoice_template"
                  label="Invoice template key"
                  rules={[{ max: 50, message: "Max 50 characters" }]}
                >
                  <Input placeholder="standard" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="receipt_template"
                  label="Receipt template key"
                  rules={[{ max: 50, message: "Max 50 characters" }]}
                >
                  <Input placeholder="thermal" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="loyalty_points_per_amount"
              label="Loyalty points per currency unit"
              rules={[{ required: true, message: "Required" }, { type: "number", min: 0, message: "≥ 0" }]}
            >
              <InputNumber min={0} step={0.01} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saveBiz.isPending}>
                Save business settings
              </Button>
            </Form.Item>
          </Form>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            Logo upload can be added via the API <Typography.Text code>logo</Typography.Text> field when media is configured.
          </Typography.Paragraph>
        </Spin>
      )}
    </Card>
  );

  const branchesTab = (
    <Card
      bordered={false}
      className="ims-card"
      title={<Space><BankOutlined /> Branches</Space>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingBranch(null);
            brForm.resetFields();
            setBranchModal(true);
          }}
        >
          Add branch
        </Button>
      }
    >
      {branchesQ.isError ? (
        <Result
          status="error"
          title="Could not load branches"
          subTitle={envelopeMessage(branchesQ.error)}
          extra={<Button onClick={() => branchesQ.refetch()}>Retry</Button>}
        />
      ) : (
        <Table
          rowKey="id"
          loading={branchesQ.isLoading}
          columns={branchCols}
          dataSource={branchesQ.data?.results ?? []}
          pagination={antServerPagination({
            page: branchPage,
            pageSize: branchPageSize,
            total: branchesQ.data?.count ?? 0,
            onChange: (p, ps) => {
              setBranchPage(p);
              setBranchPageSize(ps);
            },
          })}
        />
      )}
    </Card>
  );

  const shiftTab = (
    <Card bordered={false} className="ims-card" title={<Space><ClockCircleOutlined /> Shift (cashier)</Space>}>
      <Space direction="vertical" size="large" style={{ width: "100%", maxWidth: 440 }}>
        <div>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            Open shift
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Record opening cash drawer amount. Your user must have a branch assigned.
          </Typography.Paragraph>
          <Form form={shiftForm} layout="vertical" onFinish={(v) => openShift.mutate({ opening_cash: v.opening_cash })}>
            <Form.Item
              name="opening_cash"
              label="Opening cash"
              rules={[
                { required: true, message: "Enter opening cash" },
                { type: "number", min: 0, message: "Cannot be negative" },
              ]}
            >
              <InputNumber min={0} step={0.01} style={{ width: "100%" }} placeholder="0.00" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={openShift.isPending}>
              Open shift
            </Button>
          </Form>
        </div>
        <Divider />
        <div>
          <Typography.Title level={5}>Close shift</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Enter counts and session totals; cash difference is computed on the server.
          </Typography.Paragraph>
          <Form
            form={closeForm}
            layout="vertical"
            onFinish={(v) =>
              closeShift.mutate({
                closing_cash: v.closing_cash,
                total_sales: v.total_sales,
                total_expenses: v.total_expenses,
              })
            }
          >
            <Form.Item
              name="closing_cash"
              label="Closing cash"
              rules={[{ required: true, message: "Required" }, { type: "number", min: 0, message: "≥ 0" }]}
            >
              <InputNumber min={0} step={0.01} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="total_sales"
              label="Total sales (this session)"
              rules={[{ required: true, message: "Required" }, { type: "number", min: 0, message: "≥ 0" }]}
            >
              <InputNumber min={0} step={0.01} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="total_expenses"
              label="Total expenses (this session)"
              rules={[{ required: true, message: "Required" }, { type: "number", min: 0, message: "≥ 0" }]}
            >
              <InputNumber min={0} step={0.01} style={{ width: "100%" }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={closeShift.isPending}>
              Close shift
            </Button>
          </Form>
        </div>
      </Space>
    </Card>
  );

  return (
    <PageShell
      title="Settings"
      description="Business profile, tax, currency, branches, and shift / day closing (PRD §17)."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Administration" }, { title: "Settings" }]}
    >
      <Tabs
        defaultActiveKey="biz"
        items={[
          { key: "biz", label: "Business", children: businessTab },
          { key: "br", label: "Branches", children: branchesTab },
          { key: "shift", label: "Shift", children: shiftTab },
        ]}
      />

      <Modal
        title={editingBranch ? "Edit branch" : "New branch"}
        open={branchModal}
        onCancel={() => {
          setBranchModal(false);
          setEditingBranch(null);
          brForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={480}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Branch names must be unique in practice; use clear labels (e.g. city or store code).
        </Typography.Paragraph>
        <Form
          form={brForm}
          layout="vertical"
          onFinish={(values) =>
            saveBranch.mutate({
              id: editingBranch?.id,
              values: {
                name: values.name?.trim(),
                address: values.address?.trim() || "",
                phone: values.phone?.trim() || "",
                is_main: !!values.is_main,
              },
            })
          }
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[
              { required: true, message: "Branch name is required" },
              { min: 2, message: "At least 2 characters" },
              { max: 255, message: "Too long" },
            ]}
          >
            <Input placeholder="Karachi main" />
          </Form.Item>
          <Form.Item name="address" label="Address" rules={[{ max: 2000, message: "Address too long" }]}>
            <Input.TextArea rows={3} placeholder="Street, area…" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Phone"
            rules={[{ max: 50, message: "Max 50 characters" }]}
          >
            <Input placeholder="+92…" />
          </Form.Item>
          <Form.Item name="is_main" label="Mark as main branch" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={saveBranch.isPending}>
              {editingBranch ? "Save changes" : "Create branch"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}
