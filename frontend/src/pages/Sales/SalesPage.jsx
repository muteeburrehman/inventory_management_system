import { useState } from "react";
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { MailOutlined, StopOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelSale, emailReceipt, getSale, listSales } from "../../api/salesApi.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

const STATUS_COLOR = {
  completed: "green",
  held: "gold",
  cancelled: "default",
  returned: "orange",
};

export function SalesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");

  const listQ = useQuery({
    queryKey: ["sales-list", page, pageSize, statusFilter],
    queryFn: () =>
      listSales({
        page,
        page_size: pageSize,
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
  });

  const detailQ = useQuery({
    queryKey: ["sale-detail-page", detailId],
    queryFn: () => getSale(detailId),
    enabled: !!detailId,
  });

  const cancelMut = useMutation({
    mutationFn: cancelSale,
    onSuccess: () => {
      message.success("Sale cancelled.");
      qc.invalidateQueries({ queryKey: ["sales-list"] });
      setDetailId(null);
    },
    onError: (e) => message.error(e?.response?.data?.message || "Cancel failed."),
  });

  const emailMut = useMutation({
    mutationFn: ({ id, email }) => emailReceipt(id, email),
    onSuccess: () => {
      message.success("Receipt sent.");
      setEmailOpen(false);
    },
    onError: (e) => message.error(e?.response?.data?.detail || "Email failed."),
  });

  const rows = listQ.data?.results ?? [];
  const sale = detailQ.data;

  const columns = [
    { title: "Invoice", dataIndex: "invoice_number", width: 140 },
    {
      title: "Date",
      dataIndex: "sale_date",
      width: 180,
      render: (v) => (v ? String(v).slice(0, 19).replace("T", " ") : "—"),
    },
    {
      title: "Total",
      dataIndex: "total_amount",
      render: (v) => formatCurrency(v),
    },
    {
      title: "Paid",
      dataIndex: "paid_amount",
      render: (v) => formatCurrency(v),
    },
    {
      title: "Due",
      dataIndex: "due_amount",
      render: (v) => formatCurrency(v),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s) => <Tag color={STATUS_COLOR[s] || "default"}>{s}</Tag>,
    },
    {
      title: "",
      key: "act",
      render: (_, r) => (
        <Button type="link" onClick={() => setDetailId(r.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      title="Sales"
      description="Completed and held invoices — view details, cancel, or email receipts."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Sales" }, { title: "Sales list" }]}
    >
      <Space style={{ marginBottom: 16 }}>
        <Typography.Text>Status</Typography.Text>
        <Select
          allowClear
          placeholder="All statuses"
          style={{ width: 160 }}
          value={statusFilter || undefined}
          onChange={(v) => {
            setStatusFilter(v || "");
            setPage(1);
          }}
          options={[
            { value: "completed", label: "Completed" },
            { value: "held", label: "Held" },
            { value: "cancelled", label: "Cancelled" },
            { value: "returned", label: "Returned" },
          ]}
        />
      </Space>
      <Table
        rowKey="id"
        loading={listQ.isLoading}
        columns={columns}
        dataSource={rows}
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

      <Drawer
        title={sale ? `Sale ${sale.invoice_number}` : "Sale details"}
        width={520}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        extra={
          sale?.status === "completed" ? (
            <Space>
              <Button icon={<MailOutlined />} onClick={() => setEmailOpen(true)}>
                Email
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                loading={cancelMut.isPending}
                onClick={() => {
                  Modal.confirm({
                    title: "Cancel this sale?",
                    content: "Stock will be restored and customer balance adjusted.",
                    onOk: () => cancelMut.mutate(sale.id),
                  });
                }}
              >
                Cancel sale
              </Button>
            </Space>
          ) : null
        }
      >
        {detailQ.isLoading ? (
          <Typography.Text type="secondary">Loading…</Typography.Text>
        ) : sale ? (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Status">{sale.status}</Descriptions.Item>
              <Descriptions.Item label="Total">{formatCurrency(sale.total_amount)}</Descriptions.Item>
              <Descriptions.Item label="Paid">{formatCurrency(sale.paid_amount)}</Descriptions.Item>
              <Descriptions.Item label="Due">{formatCurrency(sale.due_amount)}</Descriptions.Item>
              <Descriptions.Item label="Payment">{sale.payment_mode}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} style={{ marginTop: 16 }}>
              Lines
            </Typography.Title>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={sale.items || []}
              columns={[
                { title: "Product", dataIndex: "product_name" },
                { title: "Qty", dataIndex: "quantity", width: 60 },
                {
                  title: "Subtotal",
                  dataIndex: "subtotal",
                  render: (v) => formatCurrency(v),
                },
              ]}
            />
          </>
        ) : null}
      </Drawer>

      <Modal
        title="Email receipt"
        open={emailOpen}
        onCancel={() => setEmailOpen(false)}
        onOk={() => sale && emailMut.mutate({ id: sale.id, email: emailTo })}
        confirmLoading={emailMut.isPending}
      >
        <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="Email" />
      </Modal>
    </PageShell>
  );
}
