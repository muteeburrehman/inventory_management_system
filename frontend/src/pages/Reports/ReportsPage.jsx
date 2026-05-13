import { useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CalendarOutlined,
  DollarOutlined,
  DropboxOutlined,
  LineChartOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  WalletOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import {
  dayClosingReport,
  duePaymentsReport,
  expensesReport,
  inventoryReport,
  profitReport,
  purchasesReport,
  salesReport,
} from "../../api/reports.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";

const CHART_HEIGHT = 280;
const PALETTE = ["#14b8a6", "#6366f1", "#f59e0b", "#ef4444", "#22c55e", "#0ea5e9", "#a855f7", "#f43f5e"];

function dateRangeParams(range) {
  if (!range || range.length !== 2 || !range[0] || !range[1]) return {};
  return {
    date_from: range[0].format("YYYY-MM-DD"),
    date_to: range[1].format("YYYY-MM-DD"),
  };
}

function StatCard({ icon, title, value, suffix, secondary, color, loading }) {
  return (
    <Card bordered={false} className="ims-card ims-stat-card" loading={loading}>
      <Space size={12} align="start">
        <span
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${color}1f`,
            color,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flex: "0 0 40px",
          }}
        >
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Statistic title={title} value={value} suffix={suffix} />
          {secondary ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {secondary}
            </Typography.Text>
          ) : null}
        </div>
      </Space>
    </Card>
  );
}

function EmptyChart({ message = "No data in this range." }) {
  return (
    <div style={{ height: CHART_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={message} />
    </div>
  );
}

function pretty(d) {
  return dayjs(d).format("DD MMM");
}

/* -------------------------------------------------------------------------- */
/*                                Sales tab                                   */
/* -------------------------------------------------------------------------- */
function SalesTab({ range }) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["reports", "sales", dateRangeParams(range)],
    queryFn: () => salesReport(dateRangeParams(range)),
    keepPreviousData: true,
  });

  const totals = data?.totals ?? {};
  const series = data?.series ?? [];
  const payments = data?.payments ?? [];
  const topProducts = data?.top_products ?? [];
  const hasSeries = series.some((s) => (s.count || 0) > 0 || (s.revenue || 0) > 0);

  return (
    <>
      <ToolBar onRefresh={refetch} loading={isFetching} />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<DollarOutlined />}
            color="#14b8a6"
            title="Revenue"
            value={formatCurrency(totals.revenue ?? 0)}
            secondary={`${totals.count ?? 0} invoice${(totals.count ?? 0) === 1 ? "" : "s"}`}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<ShoppingCartOutlined />}
            color="#6366f1"
            title="Items sold"
            value={totals.items_sold ?? 0}
            secondary={`Avg ticket ${formatCurrency(totals.avg_ticket ?? 0)}`}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<WalletOutlined />}
            color="#22c55e"
            title="Paid"
            value={formatCurrency(totals.paid ?? 0)}
            secondary={`Discount ${formatCurrency(totals.discount ?? 0)}`}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<WarningOutlined />}
            color={totals.due > 0 ? "#ef4444" : "#94a3b8"}
            title="Outstanding due"
            value={formatCurrency(totals.due ?? 0)}
            secondary="From credit sales"
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            className="ims-card"
            bordered={false}
            title={<Space><LineChartOutlined /> <span>Revenue over time</span></Space>}
            loading={isLoading}
          >
            {hasSeries ? (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={pretty} fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <ReTooltip
                    formatter={(v) => formatCurrency(v)}
                    labelFormatter={(l) => dayjs(l).format("DD MMM YYYY")}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#14b8a6" fill="url(#rev)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            className="ims-card"
            bordered={false}
            title="Payment mix"
            loading={isLoading}
          >
            {payments.length ? (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <PieChart>
                  <Pie
                    data={payments}
                    dataKey="total"
                    nameKey="mode"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {payments.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <ReTooltip formatter={(v) => formatCurrency(v)} />
                  <Legend verticalAlign="bottom" height={28} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            className="ims-card"
            bordered={false}
            title="Top selling products"
            loading={isLoading}
          >
            <Table
              size="middle"
              rowKey={(r) => `${r.id ?? r.name}`}
              dataSource={topProducts}
              pagination={false}
              locale={{ emptyText: "No sales in this range." }}
              columns={[
                { title: "#", width: 56, render: (_, __, idx) => <Tag color="default">{idx + 1}</Tag> },
                { title: "Product", dataIndex: "name" },
                { title: "SKU", dataIndex: "sku", responsive: ["md"] },
                { title: "Qty", dataIndex: "quantity", width: 90, align: "right" },
                {
                  title: "Revenue",
                  dataIndex: "revenue",
                  width: 160,
                  align: "right",
                  render: (v) => <strong>{formatCurrency(v)}</strong>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Purchases tab                                 */
/* -------------------------------------------------------------------------- */
function PurchasesTab({ range }) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["reports", "purchases", dateRangeParams(range)],
    queryFn: () => purchasesReport(dateRangeParams(range)),
    keepPreviousData: true,
  });

  const totals = data?.totals ?? {};
  const series = data?.series ?? [];
  const topSuppliers = data?.top_suppliers ?? [];
  const hasSeries = series.some((s) => (s.total || 0) > 0);

  return (
    <>
      <ToolBar onRefresh={refetch} loading={isFetching} />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<ShoppingOutlined />}
            color="#6366f1"
            title="Spent on stock"
            value={formatCurrency(totals.total ?? 0)}
            secondary={`${totals.count ?? 0} order${(totals.count ?? 0) === 1 ? "" : "s"}`}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<DropboxOutlined />}
            color="#14b8a6"
            title="Units received"
            value={totals.items_bought ?? 0}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<WalletOutlined />}
            color="#22c55e"
            title="Paid to suppliers"
            value={formatCurrency(totals.paid ?? 0)}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<WarningOutlined />}
            color={totals.due > 0 ? "#ef4444" : "#94a3b8"}
            title="Outstanding to pay"
            value={formatCurrency(totals.due ?? 0)}
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            className="ims-card"
            bordered={false}
            title={<Space><LineChartOutlined /> <span>Daily purchase spend</span></Space>}
            loading={isLoading}
          >
            {hasSeries ? (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={pretty} fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <ReTooltip
                    formatter={(v) => formatCurrency(v)}
                    labelFormatter={(l) => dayjs(l).format("DD MMM YYYY")}
                  />
                  <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            className="ims-card"
            bordered={false}
            title="Top suppliers"
            loading={isLoading}
          >
            <Table
              size="small"
              rowKey="id"
              dataSource={topSuppliers}
              pagination={false}
              locale={{ emptyText: "No supplier activity." }}
              columns={[
                { title: "Supplier", dataIndex: "name", ellipsis: true },
                { title: "Total", dataIndex: "total", align: "right", render: (v) => formatCurrency(v), width: 130 },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Inventory tab                                 */
/* -------------------------------------------------------------------------- */
function InventoryTab() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["reports", "inventory"],
    queryFn: () => inventoryReport(),
    keepPreviousData: true,
  });
  const totals = data?.totals ?? {};
  const items = data?.low_stock_items ?? [];

  const lowPct = totals.total_products
    ? Math.min(100, Math.round(((totals.low_stock_count ?? 0) / totals.total_products) * 100))
    : 0;

  return (
    <>
      <ToolBar onRefresh={refetch} loading={isFetching} hideDateNote />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<DropboxOutlined />}
            color="#14b8a6"
            title="Products"
            value={totals.total_products ?? 0}
            secondary={`${totals.total_units ?? 0} units on hand`}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<DollarOutlined />}
            color="#6366f1"
            title="Stock value (cost)"
            value={formatCurrency(totals.stock_value ?? 0)}
            secondary={`Retail value ${formatCurrency(totals.retail_value ?? 0)}`}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={totals.potential_profit >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            color={totals.potential_profit >= 0 ? "#22c55e" : "#ef4444"}
            title="Potential profit"
            value={formatCurrency(totals.potential_profit ?? 0)}
            secondary="Retail − cost on current stock"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<WarningOutlined />}
            color="#ef4444"
            title="Out of stock"
            value={totals.out_of_stock_count ?? 0}
            secondary={`${totals.low_stock_count ?? 0} more at or below min`}
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card className="ims-card" bordered={false} title="Stock health" loading={isLoading}>
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <Progress
                type="dashboard"
                percent={100 - lowPct}
                strokeColor={lowPct < 10 ? "#22c55e" : lowPct < 30 ? "#f59e0b" : "#ef4444"}
                format={(p) => `${p}%`}
              />
              <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                {totals.low_stock_count ?? 0} item{(totals.low_stock_count ?? 0) === 1 ? "" : "s"}{" "}
                at or below minimum stock. Restock to keep sales running.
              </Typography.Paragraph>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card
            className="ims-card"
            bordered={false}
            title={
              <Space>
                <WarningOutlined style={{ color: "#ef4444" }} />
                <span>Low / out of stock</span>
                <Tag color="error">{items.length}</Tag>
              </Space>
            }
            loading={isLoading}
          >
            <Table
              size="middle"
              rowKey="id"
              dataSource={items}
              pagination={false}
              locale={{ emptyText: "All products are above minimum stock." }}
              columns={[
                { title: "Product", dataIndex: "name", ellipsis: true },
                { title: "SKU", dataIndex: "sku", width: 130, responsive: ["md"] },
                { title: "Brand", dataIndex: "brand", width: 130, responsive: ["lg"] },
                {
                  title: "On hand",
                  dataIndex: "current_stock",
                  width: 100,
                  align: "right",
                  render: (v) => (v <= 0 ? <Tag color="error">{v}</Tag> : <Tag color="warning">{v}</Tag>),
                },
                {
                  title: "Min",
                  dataIndex: "min_stock_level",
                  width: 80,
                  align: "right",
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Profit tab                                  */
/* -------------------------------------------------------------------------- */
function ProfitTab({ range }) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["reports", "profit", dateRangeParams(range)],
    queryFn: () => profitReport(dateRangeParams(range)),
    keepPreviousData: true,
  });
  const totals = data?.totals ?? {};
  const series = data?.series ?? [];
  const hasSeries = series.some((s) => (s.revenue || 0) > 0 || (s.cogs || 0) > 0);

  return (
    <>
      <ToolBar onRefresh={refetch} loading={isFetching} />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<DollarOutlined />}
            color="#14b8a6"
            title="Revenue"
            value={formatCurrency(totals.revenue ?? 0)}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<ShoppingOutlined />}
            color="#6366f1"
            title="Cost of goods sold"
            value={formatCurrency(totals.cogs ?? 0)}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={totals.gross_profit >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            color={totals.gross_profit >= 0 ? "#22c55e" : "#ef4444"}
            title="Gross profit"
            value={formatCurrency(totals.gross_profit ?? 0)}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<LineChartOutlined />}
            color="#f59e0b"
            title="Margin"
            value={(totals.margin_percent ?? 0).toFixed(2)}
            suffix="%"
            loading={isLoading}
          />
        </Col>
      </Row>

      <Card
        className="ims-card"
        bordered={false}
        style={{ marginTop: 16 }}
        title={<Space><LineChartOutlined /> <span>Revenue, COGS &amp; profit</span></Space>}
        loading={isLoading}
      >
        {hasSeries ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={pretty} fontSize={12} stroke="#64748b" />
              <YAxis fontSize={12} stroke="#64748b" />
              <ReTooltip
                formatter={(v) => formatCurrency(v)}
                labelFormatter={(l) => dayjs(l).format("DD MMM YYYY")}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={2} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="cogs" stroke="#6366f1" strokeWidth={2} dot={false} name="COGS" />
              <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} dot={false} name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Expenses tab                                  */
/* -------------------------------------------------------------------------- */
function ExpensesTab({ range }) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["reports", "expenses", dateRangeParams(range)],
    queryFn: () => expensesReport(dateRangeParams(range)),
    keepPreviousData: true,
  });
  const totals = data?.totals ?? {};
  const cats = data?.categories ?? [];
  const series = data?.series ?? [];
  const hasSeries = series.some((s) => (s.total || 0) > 0);

  return (
    <>
      <ToolBar onRefresh={refetch} loading={isFetching} />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8}>
          <StatCard
            icon={<WalletOutlined />}
            color="#ef4444"
            title="Total spent"
            value={formatCurrency(totals.total ?? 0)}
            secondary={`${totals.count ?? 0} entr${totals.count === 1 ? "y" : "ies"}`}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard
            icon={<DropboxOutlined />}
            color="#6366f1"
            title="Categories used"
            value={cats.length}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={24} md={8}>
          <StatCard
            icon={<CalendarOutlined />}
            color="#14b8a6"
            title="Avg / day"
            value={formatCurrency(
              series.length ? (totals.total ?? 0) / series.length : 0,
            )}
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card className="ims-card" bordered={false} title="Daily spend" loading={isLoading}>
            {hasSeries ? (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={pretty} fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <ReTooltip
                    formatter={(v) => formatCurrency(v)}
                    labelFormatter={(l) => dayjs(l).format("DD MMM YYYY")}
                  />
                  <Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="ims-card" bordered={false} title="By category" loading={isLoading}>
            {cats.length ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={cats} dataKey="total" nameKey="name" outerRadius={80}>
                      {cats.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <ReTooltip formatter={(v) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={cats}
                  showHeader={false}
                  columns={[
                    {
                      dataIndex: "name",
                      render: (n, _, idx) => (
                        <Space>
                          <span
                            style={{
                              display: "inline-block",
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              background: PALETTE[idx % PALETTE.length],
                            }}
                          />
                          {n}
                        </Space>
                      ),
                    },
                    {
                      dataIndex: "total",
                      align: "right",
                      render: (v) => <strong>{formatCurrency(v)}</strong>,
                    },
                  ]}
                />
              </>
            ) : (
              <EmptyChart />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Due payments tab                              */
/* -------------------------------------------------------------------------- */
function DuePaymentsTab() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["reports", "due-payments"],
    queryFn: () => duePaymentsReport(),
    keepPreviousData: true,
  });
  const totals = data?.totals ?? {};
  const customers = data?.customers ?? [];
  const suppliers = data?.suppliers ?? [];

  return (
    <>
      <ToolBar onRefresh={refetch} loading={isFetching} hideDateNote />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <StatCard
            icon={<ArrowDownOutlined />}
            color="#22c55e"
            title="Customers owe us"
            value={formatCurrency(totals.customer_due ?? 0)}
            secondary={`${customers.length} customer${customers.length === 1 ? "" : "s"} with balance`}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12}>
          <StatCard
            icon={<ArrowUpOutlined />}
            color="#ef4444"
            title="We owe suppliers"
            value={formatCurrency(totals.supplier_due ?? 0)}
            secondary={`${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"} with balance`}
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card className="ims-card" bordered={false} title="Customer dues" loading={isLoading}>
            <Table
              size="middle"
              rowKey="id"
              dataSource={customers}
              pagination={false}
              locale={{ emptyText: "No outstanding customer balances." }}
              columns={[
                { title: "Customer", dataIndex: "name", ellipsis: true },
                { title: "Phone", dataIndex: "phone", responsive: ["md"], render: (v) => v || "—" },
                {
                  title: "Balance",
                  dataIndex: "balance",
                  align: "right",
                  width: 140,
                  render: (v) => <strong style={{ color: "#22c55e" }}>{formatCurrency(v)}</strong>,
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="ims-card" bordered={false} title="Supplier dues" loading={isLoading}>
            <Table
              size="middle"
              rowKey="id"
              dataSource={suppliers}
              pagination={false}
              locale={{ emptyText: "No outstanding supplier balances." }}
              columns={[
                { title: "Supplier", dataIndex: "name", ellipsis: true },
                { title: "Phone", dataIndex: "phone", responsive: ["md"], render: (v) => v || "—" },
                {
                  title: "Balance",
                  dataIndex: "balance",
                  align: "right",
                  width: 140,
                  render: (v) => <strong style={{ color: "#ef4444" }}>{formatCurrency(v)}</strong>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Day closing tab                               */
/* -------------------------------------------------------------------------- */
function DayClosingTab({ range }) {
  // Day closing uses the end of the picked range (or today by default).
  const day = range?.[1] ?? null;
  const params = day ? { date_to: day.format("YYYY-MM-DD") } : {};

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["reports", "day-closing", params],
    queryFn: () => dayClosingReport(params),
    keepPreviousData: true,
  });
  const totals = data?.totals ?? {};
  const payments = data?.payments ?? [];

  return (
    <>
      <ToolBar onRefresh={refetch} loading={isFetching} dateNote={`Closing for ${data?.date ?? "today"}`} />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<DollarOutlined />}
            color="#14b8a6"
            title="Sales revenue"
            value={formatCurrency(totals.sales_revenue ?? 0)}
            secondary={`${totals.sales_count ?? 0} invoice${totals.sales_count === 1 ? "" : "s"}`}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<WalletOutlined />}
            color="#22c55e"
            title="Cash in"
            value={formatCurrency(totals.cash_in ?? 0)}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={<WalletOutlined />}
            color="#ef4444"
            title="Cash out (expenses)"
            value={formatCurrency(totals.cash_out ?? 0)}
            secondary={`${totals.expenses_count ?? 0} entr${totals.expenses_count === 1 ? "y" : "ies"}`}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            icon={totals.net_cash >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            color={totals.net_cash >= 0 ? "#22c55e" : "#ef4444"}
            title="Net cash"
            value={formatCurrency(totals.net_cash ?? 0)}
            secondary={`Due to collect ${formatCurrency(totals.sales_due ?? 0)}`}
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card className="ims-card" bordered={false} title="Purchases on this day" loading={isLoading}>
            <Statistic
              title="Total"
              value={formatCurrency(totals.purchases_total ?? 0)}
              suffix={
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  ({totals.purchases_count ?? 0} order{totals.purchases_count === 1 ? "" : "s"})
                </Typography.Text>
              }
            />
            <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
              Paid: <strong>{formatCurrency(totals.purchases_paid ?? 0)}</strong>
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card className="ims-card" bordered={false} title="Payment breakdown" loading={isLoading}>
            <Table
              size="small"
              rowKey={(r) => r.mode}
              dataSource={payments}
              pagination={false}
              locale={{ emptyText: "No payments recorded." }}
              columns={[
                { title: "Mode", dataIndex: "mode", render: (v) => (v || "—").toUpperCase() },
                { title: "Count", dataIndex: "count", align: "right", width: 80 },
                { title: "Amount", dataIndex: "total", align: "right", render: (v) => formatCurrency(v) },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function ToolBar({ onRefresh, loading, dateNote, hideDateNote }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {hideDateNote ? <span /> : (
        <Typography.Text type="secondary">{dateNote || "Pick a date range above."}</Typography.Text>
      )}
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        Refresh
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Page                                      */
/* -------------------------------------------------------------------------- */
export function ReportsPage() {
  const _app = App.useApp();
  const [range, setRange] = useState(() => [dayjs().subtract(29, "day"), dayjs()]);

  const tabs = useMemo(
    () => [
      { key: "sales", label: "Sales", children: <SalesTab range={range} /> },
      { key: "purchases", label: "Purchases", children: <PurchasesTab range={range} /> },
      { key: "inventory", label: "Inventory", children: <InventoryTab /> },
      { key: "profit", label: "Profit", children: <ProfitTab range={range} /> },
      { key: "expenses", label: "Expenses", children: <ExpensesTab range={range} /> },
      { key: "due", label: "Due payments", children: <DuePaymentsTab /> },
      { key: "day", label: "Day closing", children: <DayClosingTab range={range} /> },
    ],
    [range],
  );

  const presets = [
    { label: "Today", value: [dayjs(), dayjs()] },
    { label: "Last 7 days", value: [dayjs().subtract(6, "day"), dayjs()] },
    { label: "Last 30 days", value: [dayjs().subtract(29, "day"), dayjs()] },
    { label: "This month", value: [dayjs().startOf("month"), dayjs()] },
    { label: "Last month", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
  ];

  return (
    <PageShell
      title="Reports"
      description="Live business insights. Pick a date range and switch tabs to drill into sales, purchases, inventory, profit, expenses, dues and day-closing."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Insights" }, { title: "Reports" }]}
    >
      <Card bordered={false} className="ims-card" style={{ marginBottom: 16 }}>
        <Space wrap align="center">
          <CalendarOutlined style={{ color: "#64748b" }} />
          <Typography.Text strong>Date range</Typography.Text>
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => setRange(v || [])}
            presets={presets}
            allowClear
            style={{ minWidth: 280 }}
          />
        </Space>
      </Card>

      <Tabs items={tabs} destroyInactiveTabPane={false} />
    </PageShell>
  );
}
