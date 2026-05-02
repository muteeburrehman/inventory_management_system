import {
  Alert,
  Card,
  Col,
  List,
  Row,
  Statistic,
  Table,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  FallOutlined,
  RiseOutlined,
  ShoppingOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../api/axios.js";
import { formatCurrency } from "../../utils/currency.js";

async function fetchSummary() {
  const { data } = await api.get("/dashboard/summary/");
  return data?.data ?? data;
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard-summary"], queryFn: fetchSummary });

  const chartData =
    data?.revenue_chart?.map((row) => ({
      date: row.d,
      total: Number(row.total || 0),
    })) ?? [];

  const kpi = (title, value, icon, suffix) => (
    <Card className="ims-stat-card" loading={isLoading} bordered={false}>
      <Statistic title={title} value={value} prefix={icon} suffix={suffix} />
    </Card>
  );

  return (
    <div style={{ maxWidth: 1400 }}>
      <Typography.Title level={2} style={{ margin: "0 0 8px", fontWeight: 700, letterSpacing: "-0.02em" }}>
        Executive dashboard
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Snapshot aligned with PRD §1 — operations, parties, and cash position.
      </Typography.Paragraph>

      {(data?.low_stock_count > 0 || data?.out_of_stock_count > 0) && (
        <Alert
          style={{ marginBottom: 20 }}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="Inventory attention"
          description={
            <span>
              {data?.low_stock_count} SKU(s) below minimum · {data?.out_of_stock_count} out of stock.{" "}
              <Link to="/products">Review products</Link> · <Link to="/inventory">Stock control</Link>
            </span>
          }
        />
      )}

      <Typography.Title level={5} style={{ margin: "8px 0 12px", color: "#475569" }}>
        Master data
      </Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}>
          {kpi("Products", data?.total_products ?? "—", <AppstoreOutlined style={{ opacity: 0.45 }} />)}
        </Col>
        <Col xs={12} sm={8} lg={4}>
          {kpi("Categories", data?.total_categories ?? "—", <ShoppingOutlined style={{ opacity: 0.45 }} />)}
        </Col>
        <Col xs={12} sm={8} lg={4}>
          {kpi("Customers", data?.total_customers ?? "—", <UserOutlined style={{ opacity: 0.45 }} />)}
        </Col>
        <Col xs={12} sm={8} lg={4}>
          {kpi("Suppliers", data?.total_suppliers ?? "—", <TeamOutlined style={{ opacity: 0.45 }} />)}
        </Col>
      </Row>

      <Typography.Title level={5} style={{ margin: "24px 0 12px", color: "#475569" }}>
        Sales &amp; collections
      </Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          {kpi("Sales today", formatCurrency(data?.sales_today), <RiseOutlined style={{ color: "#0f766e" }} />)}
        </Col>
        <Col xs={24} sm={12} lg={6}>
          {kpi("Monthly revenue", formatCurrency(data?.monthly_revenue), <RiseOutlined style={{ color: "#0f766e" }} />)}
        </Col>
        <Col xs={24} sm={12} lg={6}>
          {kpi("Total sales (all)", formatCurrency(data?.total_sales_all_time), null)}
        </Col>
        <Col xs={24} sm={12} lg={6}>
          {kpi("Pending payments", formatCurrency(data?.pending_payments), <FallOutlined style={{ color: "#b45309" }} />)}
        </Col>
        <Col xs={24} sm={12} lg={6}>
          {kpi("Receivables", formatCurrency(data?.outstanding_receivables), null)}
        </Col>
        <Col xs={24} sm={12} lg={6}>
          {kpi("Payables", formatCurrency(data?.outstanding_payables), null)}
        </Col>
      </Row>

      <Typography.Title level={5} style={{ margin: "24px 0 12px", color: "#475569" }}>
        Stock &amp; profit
      </Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8} lg={6}>
          {kpi("Low stock", data?.low_stock_count ?? 0, <WarningOutlined style={{ color: "#ca8a04" }} />)}
        </Col>
        <Col xs={24} sm={8} lg={6}>
          {kpi("Out of stock", data?.out_of_stock_count ?? 0, <WarningOutlined style={{ color: "#dc2626" }} />)}
        </Col>
        <Col xs={24} sm={8} lg={12}>
          <Card className="ims-stat-card" loading={isLoading} bordered={false}>
            <Statistic
              title="Profit summary (month)"
              value={formatCurrency(data?.profit_summary?.month_revenue)}
              prefix={<RiseOutlined style={{ color: "#0f766e" }} />}
            />
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
              {data?.profit_summary?.note}
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={14}>
          <Card className="ims-card" title="Revenue trend (30 days)" bordered={false} loading={isLoading}>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => (v ? String(v).slice(5, 10) : "")} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="ims-card" title="Recent invoices" bordered={false} loading={isLoading} extra={<Link to="/pos">POS →</Link>}>
            <List
              size="small"
              dataSource={data?.recent_sales ?? []}
              renderItem={(item) => (
                <List.Item>
                  <span>{item.invoice_number}</span>
                  <strong>{formatCurrency(item.total_amount)}</strong>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={24}>
          <Card className="ims-card" title="Recent purchase invoices" bordered={false} loading={isLoading} extra={<Link to="/purchases">Purchases →</Link>}>
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={data?.recent_purchases ?? []}
              columns={[
                { title: "Invoice", dataIndex: "invoice_number" },
                { title: "Supplier", dataIndex: "supplier_name" },
                { title: "Date", dataIndex: "purchase_date" },
                { title: "Amount", dataIndex: "total_amount", render: (v) => formatCurrency(v) },
                { title: "Status", dataIndex: "status" },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
