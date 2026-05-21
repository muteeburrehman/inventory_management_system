import { useState } from "react";
import { App, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeTransfer,
  getStock,
  listMovements,
  listTransfers,
  postAdjustment,
  postTransfer,
} from "../../api/inventory.js";
import { listProducts } from "../../api/products.js";
import { listBranches } from "../../api/settings.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

export function InventoryPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [adjOpen, setAdjOpen] = useState(false);
  const [xferOpen, setXferOpen] = useState(false);
  const [adjForm] = Form.useForm();
  const [xferForm] = Form.useForm();

  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(25);
  const [movPage, setMovPage] = useState(1);
  const [movPageSize, setMovPageSize] = useState(25);
  const [xferListPage, setXferListPage] = useState(1);
  const [xferListPageSize, setXferListPageSize] = useState(25);

  const stockQ = useQuery({
    queryKey: ["inventory-stock", stockPage, stockPageSize],
    queryFn: () => getStock({ page: stockPage, page_size: stockPageSize }),
  });
  const movQ = useQuery({
    queryKey: ["inventory-movements", movPage, movPageSize],
    queryFn: () => listMovements({ page: movPage, page_size: movPageSize }),
  });
  const prodQ = useQuery({
    queryKey: ["products-inv-options"],
    queryFn: () => listProducts({ page: 1, page_size: 100 }),
  });
  const brQ = useQuery({
    queryKey: ["branches", "inv-options"],
    queryFn: () => listBranches({ page: 1, page_size: 100 }),
  });

  const adjMut = useMutation({
    mutationFn: postAdjustment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-stock"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      message.success("Stock adjusted.");
      setAdjOpen(false);
      adjForm.resetFields();
    },
    onError: (e) => message.error(e?.response?.data?.detail || "Adjustment failed."),
  });

  const xferMut = useMutation({
    mutationFn: postTransfer,
    onSuccess: () => {
      message.success("Transfer recorded (pending fulfilment).");
      setXferOpen(false);
      xferForm.resetFields();
      qc.invalidateQueries({ queryKey: ["inventory-transfers"] });
    },
    onError: (e) => message.error(e?.response?.data?.message || "Transfer failed."),
  });

  const xferListQ = useQuery({
    queryKey: ["inventory-transfers", xferListPage, xferListPageSize],
    queryFn: () => listTransfers({ page: xferListPage, page_size: xferListPageSize }),
  });

  const completeMut = useMutation({
    mutationFn: completeTransfer,
    onSuccess: () => {
      message.success("Transfer completed.");
      qc.invalidateQueries({ queryKey: ["inventory-transfers"] });
      qc.invalidateQueries({ queryKey: ["inventory-stock"] });
    },
    onError: (e) => message.error(e?.response?.data?.detail || "Complete failed."),
  });

  const stockCols = [
    { title: "SKU", dataIndex: "sku", width: 120 },
    { title: "Product", dataIndex: "name", ellipsis: true },
    {
      title: "Stock",
      dataIndex: "current_stock",
      width: 100,
    },
    {
      title: "Min level",
      dataIndex: "min_stock_level",
      width: 100,
    },
    {
      title: "Purchase",
      dataIndex: "purchase_price",
      width: 110,
      render: (v) => formatCurrency(v),
    },
  ];

  const movCols = [
    { title: "When", dataIndex: "created_at", width: 180 },
    { title: "Type", dataIndex: "movement_type", width: 100 },
    { title: "Product", key: "pn", ellipsis: true, render: (_, r) => r.product_name || r.product },
    { title: "Qty", dataIndex: "quantity", width: 70 },
    { title: "Reason", dataIndex: "reason", ellipsis: true },
    { title: "Ref", dataIndex: "reference", width: 120 },
  ];

  const productRows = prodQ.data?.results ?? [];
  const prodOptions = productRows.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));
  const branchOptions = (brQ.data?.results ?? []).map((b) => ({ value: b.id, label: b.name }));

  const stockRows = stockQ.data?.results ?? [];
  const stockTotal = stockQ.data?.count ?? 0;
  const movRows = movQ.data?.results ?? [];
  const movTotal = movQ.data?.count ?? 0;

  const tabItems = [
    {
      key: "s",
      label: "Stock levels",
      children: (
        <Card
          bordered={false}
          className="ims-card"
          extra={
            <Space>
              <Button onClick={() => setAdjOpen(true)}>Adjust stock</Button>
              <Button onClick={() => setXferOpen(true)}>Transfer</Button>
            </Space>
          }
        >
          <Table
            rowKey="id"
            size="small"
            loading={stockQ.isLoading}
            columns={stockCols}
            dataSource={stockRows}
            pagination={antServerPagination({
              page: stockPage,
              pageSize: stockPageSize,
              total: stockTotal,
              onChange: (p, ps) => {
                setStockPage(p);
                setStockPageSize(ps);
              },
            })}
          />
        </Card>
      ),
    },
    {
      key: "t",
      label: "Transfers",
      children: (
        <Card bordered={false} className="ims-card">
          <Table
            rowKey="id"
            size="small"
            loading={xferListQ.isLoading}
            dataSource={xferListQ.data?.results ?? []}
            columns={[
              { title: "ID", dataIndex: "id", width: 60 },
              { title: "From", dataIndex: "from_branch_name" },
              { title: "To", dataIndex: "to_branch_name" },
              { title: "Product", dataIndex: "product_name", ellipsis: true },
              { title: "Qty", dataIndex: "quantity", width: 70 },
              { title: "Status", dataIndex: "status", width: 100 },
              {
                title: "",
                key: "c",
                render: (_, r) =>
                  r.status === "pending" ? (
                    <Button type="link" size="small" onClick={() => completeMut.mutate(r.id)}>
                      Complete
                    </Button>
                  ) : null,
              },
            ]}
            pagination={antServerPagination({
              page: xferListPage,
              pageSize: xferListPageSize,
              total: xferListQ.data?.count ?? 0,
              onChange: (p, ps) => {
                setXferListPage(p);
                setXferListPageSize(ps);
              },
            })}
          />
        </Card>
      ),
    },
    {
      key: "m",
      label: "Movements",
      children: (
        <Card bordered={false} className="ims-card">
          <Table
            rowKey="id"
            size="small"
            loading={movQ.isLoading}
            columns={movCols}
            dataSource={movRows}
            pagination={antServerPagination({
              page: movPage,
              pageSize: movPageSize,
              total: movTotal,
              onChange: (p, ps) => {
                setMovPage(p);
                setMovPageSize(ps);
              },
            })}
          />
        </Card>
      ),
    },
  ];

  return (
    <PageShell
      title="Inventory control"
      description="Levels, adjustments, and inter-branch transfers (PRD §8). Adjustments require a branch on your profile."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Operations" }, { title: "Inventory" }]}
    >
      <Tabs items={tabItems} />

      <Modal title="Stock adjustment" open={adjOpen} onCancel={() => setAdjOpen(false)} footer={null} destroyOnClose>
        <Form
          form={adjForm}
          layout="vertical"
          onFinish={(v) =>
            adjMut.mutate({
              product: v.product,
              quantity: v.quantity,
              reason: v.reason || "adjustment",
              reference: v.reference || "",
              variant: v.variant || null,
            })
          }
        >
          <Form.Item name="product" label="Product" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={prodOptions} />
          </Form.Item>
          <Form.Item name="quantity" label="Quantity delta (+ / −)" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Typography.Text type="secondary">Positive adds stock; negative removes.</Typography.Text>
          <Form.Item name="reason" label="Reason">
            <Input placeholder="damage, expiry, count correction…" />
          </Form.Item>
          <Form.Item name="reference" label="Reference">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={adjMut.isPending} block>
            Apply
          </Button>
        </Form>
      </Modal>

      <Modal title="Stock transfer" open={xferOpen} onCancel={() => setXferOpen(false)} footer={null} destroyOnClose>
        <Form
          form={xferForm}
          layout="vertical"
          onFinish={(v) =>
            xferMut.mutate({
              from_branch: v.from_branch,
              to_branch: v.to_branch,
              product: v.product,
              quantity: v.quantity,
            })
          }
        >
          <Form.Item name="from_branch" label="From branch" rules={[{ required: true }]}>
            <Select options={branchOptions} />
          </Form.Item>
          <Form.Item name="to_branch" label="To branch" rules={[{ required: true }]}>
            <Select options={branchOptions} />
          </Form.Item>
          <Form.Item name="product" label="Product" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={prodOptions} />
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={xferMut.isPending} block>
            Create transfer
          </Button>
        </Form>
      </Modal>
    </PageShell>
  );
}
