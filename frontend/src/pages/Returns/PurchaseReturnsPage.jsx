import { useEffect, useState } from "react";
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Space, Table, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getPurchase, listPurchases, purchaseReturn } from "../../api/purchases.js";
import { listSuppliers } from "../../api/suppliers.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

export function PurchaseReturnsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [poId, setPoId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);

  const purQ = useQuery({
    queryKey: ["purchase-returns-list", listPage, listPageSize],
    queryFn: () => listPurchases({ status: "received", page: listPage, page_size: listPageSize }),
  });
  const supQ = useQuery({
    queryKey: ["suppliers", "purchase-return-labels"],
    queryFn: () => listSuppliers({ page: 1, page_size: 100 }),
  });

  const detailQ = useQuery({
    queryKey: ["purchase-detail-ret", poId],
    queryFn: () => getPurchase(poId),
    enabled: modalOpen && !!poId,
  });

  const [lineQty, setLineQty] = useState({});

  useEffect(() => {
    if (detailQ.data?.items?.length) {
      setLineQty(Object.fromEntries(detailQ.data.items.map((_, idx) => [idx, 0])));
    }
  }, [detailQ.data]);

  const retMut = useMutation({
    mutationFn: ({ id, body }) => purchaseReturn(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-returns-list"] });
      message.success("Purchase return recorded.");
      setModalOpen(false);
      setPoId(null);
      form.resetFields();
    },
    onError: (e) => message.error(e?.response?.data?.message || JSON.stringify(e?.response?.data) || "Return failed."),
  });

  const listRows = purQ.data?.results ?? [];
  const listTotal = purQ.data?.count ?? 0;
  const supplierRows = supQ.data?.results ?? [];
  const supplierMap = Object.fromEntries(supplierRows.map((s) => [s.id, s.name]));

  const openReturn = (row) => {
    setPoId(row.id);
    form.setFieldsValue({
      return_date: dayjs(),
      reason: "",
      total_amount: 0,
    });
    setModalOpen(true);
  };

  const onSubmit = () => {
    const po = detailQ.data;
    if (!po) return;
    const values = form.getFieldsValue();
    const items = (po.items || [])
      .map((line, i) => ({
        product: line.product,
        quantity: Number(lineQty[i] || 0),
        price: line.purchase_price,
      }))
      .filter((row) => row.quantity > 0);

    if (!items.length) {
      message.warning("Enter at least one line quantity.");
      return;
    }

    const computedTotal = items.reduce((acc, row) => acc + Number(row.quantity) * Number(row.price), 0);
    const override = values.total_amount;
    const totalStr =
      override != null && Number(override) > 0 ? String(override) : String(computedTotal);

    retMut.mutate({
      id: po.id,
      body: {
        return_date: values.return_date ? values.return_date.format("YYYY-MM-DD") : undefined,
        reason: values.reason || "",
        total_amount: totalStr,
        items,
      },
    });
  };

  const columns = [
    { title: "Invoice", dataIndex: "invoice_number", width: 120 },
    {
      title: "Supplier",
      dataIndex: "supplier",
      render: (id) => supplierMap[id] ?? id,
      ellipsis: true,
    },
    { title: "Date", dataIndex: "purchase_date", width: 110 },
    {
      title: "Total",
      dataIndex: "total_amount",
      width: 110,
      render: (v) => formatCurrency(v),
    },
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
      title="Purchase returns"
      description="Return stock to suppliers; updates GRN and supplier balance (PRD §11)."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Returns" }, { title: "Purchase returns" }]}
    >
      <Card bordered={false} className="ims-card">
        <Table
          rowKey="id"
          loading={purQ.isLoading}
          columns={columns}
          dataSource={listRows}
          pagination={antServerPagination({
            page: listPage,
            pageSize: listPageSize,
            total: listTotal,
            onChange: (p, ps) => {
              setListPage(p);
              setListPageSize(ps);
            },
          })}
        />
      </Card>

      <Modal
        title={detailQ.data ? `Return ${detailQ.data.invoice_number}` : "Purchase return"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setPoId(null);
        }}
        onOk={onSubmit}
        okText="Submit return"
        confirmLoading={retMut.isPending}
        width={640}
        destroyOnClose
      >
        {detailQ.isLoading && <Typography.Paragraph>Loading purchase…</Typography.Paragraph>}
        {detailQ.data && (
          <Form form={form} layout="vertical">
            <Space wrap>
              <Form.Item name="return_date" label="Return date" rules={[{ required: true }]} style={{ minWidth: 200 }}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="total_amount" label="Total amount override" style={{ minWidth: 180 }}>
                <InputNumber min={0} style={{ width: "100%" }} placeholder="Auto from lines" />
              </Form.Item>
            </Space>
            <Form.Item name="reason" label="Reason">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Typography.Text strong>Quantities to return</Typography.Text>
            <Table
              size="small"
              style={{ marginTop: 8 }}
              rowKey="id"
              pagination={false}
              dataSource={detailQ.data.items || []}
              columns={[
                { title: "Product ID", dataIndex: "product", width: 90 },
                { title: "Qty bought", dataIndex: "quantity", width: 90 },
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
