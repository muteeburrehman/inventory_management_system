import { useEffect, useState } from "react";
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Space, Table, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getSale, listSales, submitSalesReturn } from "../../api/salesApi.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

export function SalesReturnsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [saleId, setSaleId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);

  const salesQ = useQuery({
    queryKey: ["sales-returns-list", listPage, listPageSize],
    queryFn: () => listSales({ status: "completed", page: listPage, page_size: listPageSize }),
  });

  const salesRows = salesQ.data?.results ?? [];
  const salesTotal = salesQ.data?.count ?? 0;

  const detailQ = useQuery({
    queryKey: ["sale-detail", saleId],
    queryFn: () => getSale(saleId),
    enabled: modalOpen && !!saleId,
  });

  const [lineQty, setLineQty] = useState({});

  useEffect(() => {
    if (detailQ.data?.items?.length) {
      setLineQty(Object.fromEntries(detailQ.data.items.map((_, idx) => [idx, 0])));
    }
  }, [detailQ.data]);

  const retMut = useMutation({
    mutationFn: ({ id, body }) => submitSalesReturn(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-returns-list"] });
      message.success("Return recorded.");
      setModalOpen(false);
      setSaleId(null);
      form.resetFields();
    },
    onError: (e) => message.error(e?.response?.data?.message || e?.response?.data?.detail || "Return failed."),
  });

  const openReturn = (row) => {
    setSaleId(row.id);
    form.setFieldsValue({
      return_date: dayjs(),
      refund_amount: 0,
      reason: "",
    });
    setModalOpen(true);
  };

  const onSubmit = () => {
    const sale = detailQ.data;
    if (!sale) return;
    const values = form.getFieldsValue();
    const items = (sale.items || [])
      .map((line, i) => ({
        product: line.product,
        quantity: Number(lineQty[i] || 0),
        price: line.unit_price,
      }))
      .filter((row) => row.quantity > 0);

    if (!items.length) {
      message.warning("Enter at least one line quantity.");
      return;
    }

    retMut.mutate({
      id: sale.id,
      body: {
        return_date: values.return_date ? values.return_date.format("YYYY-MM-DD") : undefined,
        return_type: "partial",
        refund_amount: values.refund_amount ?? 0,
        reason: values.reason || "",
        items,
      },
    });
  };

  const columns = [
    { title: "Invoice", dataIndex: "invoice_number", width: 120 },
    { title: "Date", dataIndex: "sale_date", width: 180 },
    {
      title: "Total",
      dataIndex: "total_amount",
      width: 120,
      render: (v) => formatCurrency(v),
    },
    { title: "Due", dataIndex: "due_amount", width: 100, render: (v) => formatCurrency(v) },
    {
      title: "",
      key: "a",
      width: 100,
      render: (_, r) => (
        <Button type="link" onClick={() => openReturn(r)}>
          Return
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      title="Sales returns"
      description="Partial or full returns with refund tracking (PRD §10). Requires refund permission for your role."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Returns" }, { title: "Sales returns" }]}
    >
      <Card bordered={false} className="ims-card">
        <Table
          rowKey="id"
          loading={salesQ.isLoading}
          columns={columns}
          dataSource={salesRows}
          pagination={antServerPagination({
            page: listPage,
            pageSize: listPageSize,
            total: salesTotal,
            onChange: (p, ps) => {
              setListPage(p);
              setListPageSize(ps);
            },
          })}
        />
      </Card>

      <Modal
        title={detailQ.data ? `Return ${detailQ.data.invoice_number}` : "Sales return"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setSaleId(null);
        }}
        onOk={onSubmit}
        okText="Submit return"
        confirmLoading={retMut.isPending}
        width={640}
        destroyOnClose
      >
        {detailQ.isLoading && <Typography.Paragraph>Loading invoice…</Typography.Paragraph>}
        {detailQ.data && (
          <Form form={form} layout="vertical">
            <Space wrap>
              <Form.Item name="return_date" label="Return date" rules={[{ required: true }]} style={{ minWidth: 200 }}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="refund_amount" label="Refund amount" style={{ minWidth: 160 }}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Space>
            <Form.Item name="reason" label="Reason">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Typography.Text strong>Line quantities to return</Typography.Text>
            <Table
              size="small"
              style={{ marginTop: 8 }}
              rowKey="id"
              pagination={false}
              dataSource={detailQ.data.items || []}
              columns={[
                { title: "Product", dataIndex: "product_name" },
                { title: "Sold", dataIndex: "quantity", width: 70 },
                {
                  title: "Return qty",
                  key: "rq",
                  width: 120,
                  render: (_, row, i) => (
                    <InputNumber
                      min={0}
                      max={row.quantity}
                      size="small"
                      value={lineQty[i] ?? 0}
                      onChange={(v) => setLineQty((s) => ({ ...s, [i]: v ?? 0 }))}
                    />
                  ),
                },
              ]}
            />
          </Form>
        )}
      </Modal>
    </PageShell>
  );
}
