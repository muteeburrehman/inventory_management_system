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
import { useAuthStore } from "../../store/authStore.js";

async function fetchSummary() {
  const { data } = await api.get("/dashboard/summary/");
  return data?.data ?? data;
}

export function DashboardPage() {
  const branchId = useAuthStore((s) => s.user?.branch?.id);
  const meRole = useAuthStore((s) => s.user?.role);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard-summary", meRole, branchId],
    queryFn: fetchSummary,
  });

  const w = data?.role_widgets ?? {};
  const scope = data?.scope;

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

  const errMsg = error?.response?.data?.message ?? error?.message;

  return (
    <div style={{ maxWidth: 1400 }}>
      <Typography.Title level={2} style={{ margin: "0 0 8px", fontWeight: 700, letterSpacing: "-0.02em" }}>
        Executive dashboard
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        Operations snapshot scoped to your branch selection. Products and categories are company-wide;
        customers and suppliers (cards below) count master records linked to the selected branch. Sales, purchases,
        expenses, and stock risk reflect the aggregated branches below.
      </Typography.Paragraph>
      {scope?.label ? (
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          <strong>Data scope:</strong> {scope.label}
          {scope.aggregate_all ? " (combined)" : ""}
          {scope.mode === "multi" ? " — multiple branches" : ""}
        </Typography.Text>
      ) : null}

      {isError && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={errMsg || "Could not load dashboard."} />
      )}

      {w.show_inventory_health &&
        (data?.low_stock_count > 0 || data?.out_of_stock_count > 0) && (
          <Alert
            style={{ marginBottom: 20 }}
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message="Inventory attention (this branch scope)"
            description={
              <span>
                {data?.low_stock_count} SKU(s) below minimum · {data?.out_of_stock_count} out of stock at this scope.{" "}
                <Link to="/products">Review products</Link> · <Link to="/inventory">Stock control</Link>
              </span>
            }
          />
        )}

      <Typography.Title level={5} style={{ margin: "8px 0 12px", color: "#475569" }}>
        Master data <Typography.Text type="secondary">(company-wide catalog)</Typography.Text>
      </Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}>
          {kpi("Products", data?.total_products ?? "—", <AppstoreOutlined style={{ opacity: 0.45 }} />)}
        </Col>
        <Col xs={12} sm={8} lg={4}>
          {kpi("Categories", data?.total_categories ?? "—", <ShoppingOutlined style={{ opacity: 0.45 }} />)}
        </Col>
        <Col xs={12} sm={8} lg={4}>
          {kpi("Customers (scope)", data?.total_customers ?? "—", <UserOutlined style={{ opacity: 0.45 }} />)}
        </Col>
        <Col xs={12} sm={8} lg={4}>
          {kpi("Suppliers (scope)", data?.total_suppliers ?? "—", <TeamOutlined style={{ opacity: 0.45 }} />)}
        </Col>
      </Row>

      {w.show_sales_kpis !== false && (
        <>
          <Typography.Title level={5} style={{ margin: "24px 0 12px", color: "#475569" }}>
            Sales &amp; collections <Typography.Text type="secondary">(selected scope)</Typography.Text>
          </Typography.Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              {kpi("Sales today", formatCurrency(data?.sales_today), <RiseOutlined style={{ color: "#0f766e" }} />)}
            </Col>
            <Col xs={24} sm={12} lg={6}>
              {kpi(
                "Monthly revenue",
                formatCurrency(data?.monthly_revenue),
                <RiseOutlined style={{ color: "#0f766e" }} />,
              )}
            </Col>
            <Col xs={24} sm={12} lg={6}>
              {kpi("Total sales (scope)", formatCurrency(data?.total_sales_all_time), null)}
            </Col>
            <Col xs={24} sm={12} lg={6}>
              {kpi(
                "Pending payments",
                formatCurrency(data?.pending_payments),
                <FallOutlined style={{ color: "#b45309" }} />,
              )}
            </Col>
            {w.show_finance_balances && (
              <>
                <Col xs={24} sm={12} lg={6}>
                  {kpi("Receivables exposure", formatCurrency(data?.outstanding_receivables), null)}
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  {kpi("Payables exposure", formatCurrency(data?.outstanding_payables), null)}
                </Col>
              </>
            )}
          </Row>
        </>
      )}

      {w.show_inventory_health && (
        <>
          <Typography.Title level={5} style={{ margin: "24px 0 12px", color: "#475569" }}>
            Stock &amp; margin <Typography.Text type="secondary">(branch stock from movements)</Typography.Text>
          </Typography.Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8} lg={6}>
              {kpi("Low stock", data?.low_stock_count ?? 0, <WarningOutlined style={{ color: "#ca8a04" }} />)}
            </Col>
            <Col xs={24} sm={8} lg={6}>
              {kpi("Out of stock", data?.out_of_stock_count ?? 0, <WarningOutlined style={{ color: "#dc2626" }} />)}
            </Col>
            {w.show_profit_card && (
              <Col xs={24} sm={8} lg={12}>
                <Card className="ims-stat-card" loading={isLoading} bordered={false}>
                  <Statistic
                    title="Sales vs expenses (month, scope)"
                    value={formatCurrency(data?.profit_summary?.month_revenue)}
                    prefix={<RiseOutlined style={{ color: "#0f766e" }} />}
                  />
                  <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                    Branch expenses (month):{" "}
                    <strong>{formatCurrency(data?.month_expenses ?? data?.profit_summary?.month_expenses)}</strong>
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
                    {data?.profit_summary?.note}
                  </Typography.Text>
                </Card>
              </Col>
            )}
          </Row>
        </>
      )}

      {w.show_revenue_chart !== false && (
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24} lg={14}>
            <Card className="ims-card" title="Revenue trend (30 days, scope)" bordered={false} loading={isLoading}>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => (v ? String(v).slice(5, 10) : "")}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          {w.show_recent_sales !== false && (
            <Col xs={24} lg={10}>
              <Card
                className="ims-card"
                title="Recent invoices"
                bordered={false}
                loading={isLoading}
                extra={<Link to="/pos">POS →</Link>}
              >
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
          )}
        </Row>
      )}

      {w.show_revenue_chart === false && w.show_recent_sales !== false && (
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24} lg={10}>
            <Card
              className="ims-card"
              title="Recent invoices"
              bordered={false}
              loading={isLoading}
              extra={<Link to="/pos">POS →</Link>}
            >
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
        </Row>
      )}

      {w.show_purchasing && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={24}>
            <Card
              className="ims-card"
              title="Recent purchase invoices"
              bordered={false}
              loading={isLoading}
              extra={<Link to="/purchases">Purchases →</Link>}
            >
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
      )}
    </div>
  );
}
