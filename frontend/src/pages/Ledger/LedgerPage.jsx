import { useEffect, useMemo, useState } from "react";
import { Card, Col, Descriptions, Row, Select, Space, Statistic, Table, Tabs, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCashFlow,
  fetchProfitLoss,
  fetchTrialBalance,
  listLedgerEntries,
} from "../../api/ledger.js";
import { listBranches } from "../../api/settings.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

const LEDGER_TYPES = [
  { value: "", label: "All types" },
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "expense", label: "Expense" },
  { value: "sales", label: "Sales" },
  { value: "purchase", label: "Purchase" },
];

export function LedgerPage() {
  const [type, setType] = useState("");
  const [branchId, setBranchId] = useState(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [type, branchId]);

  const branchesQ = useQuery({
    queryKey: ["branches", "ledger-filter"],
    queryFn: () => listBranches({ page_size: 100 }),
  });
  const branchFilterOptions = useMemo(
    () =>
      (branchesQ.data?.results ?? []).map((b) => ({
        value: b.id,
        label: b.name,
      })),
    [branchesQ.data?.results]
  );

  const entriesQ = useQuery({
    queryKey: ["ledger", type, branchId, page, pageSize],
    queryFn: () =>
      listLedgerEntries({
        page,
        page_size: pageSize,
        ...(type ? { ledger_type: type } : {}),
        ...(branchId ? { branch: branchId } : {}),
      }),
  });
  const trialQ = useQuery({ queryKey: ["ledger-tb"], queryFn: fetchTrialBalance });
  const plQ = useQuery({ queryKey: ["ledger-pl"], queryFn: fetchProfitLoss });
  const cfQ = useQuery({ queryKey: ["ledger-cf"], queryFn: fetchCashFlow });

  const rows = entriesQ.data?.results ?? [];
  const entryTotal = entriesQ.data?.count ?? 0;

  const entryColumns = [
    { title: "Date", dataIndex: "entry_date", width: 110 },
    { title: "Type", dataIndex: "ledger_type", width: 100 },
    {
      title: "Branch",
      key: "branch",
      width: 130,
      ellipsis: true,
      render: (_, row) => row.branch?.name ?? "—",
    },
    { title: "Ref #", dataIndex: "reference_number", width: 120, ellipsis: true },
    { title: "Description", dataIndex: "description", ellipsis: true },
    {
      title: "Debit",
      dataIndex: "debit",
      width: 110,
      render: (v) => formatCurrency(v),
    },
    {
      title: "Credit",
      dataIndex: "credit",
      width: 110,
      render: (v) => formatCurrency(v),
    },
    {
      title: "Balance",
      dataIndex: "balance",
      width: 110,
      render: (v) => formatCurrency(v),
    },
  ];

  const tb = trialQ.data ?? {};
  const pl = plQ.data ?? {};
  const cf = cfQ.data ?? {};

  return (
    <PageShell
      title="Ledger & accounting"
      description="Posted entries from sales, purchases, and expenses. Financial summaries use the same API the PRD describes (PRD §12)."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Finance" }, { title: "Ledger" }]}
    >
      <Tabs
        defaultActiveKey="entries"
        items={[
          {
            key: "entries",
            label: "Ledger entries",
            children: (
              <Card bordered={false} className="ims-card">
                <Space style={{ marginBottom: 16 }} wrap>
                  <Typography.Text type="secondary">Filter</Typography.Text>
                  <Select
                    style={{ width: 200 }}
                    value={type}
                    onChange={(v) => setType(v)}
                    options={LEDGER_TYPES}
                  />
                  <Select
                    allowClear
                    placeholder="All branches"
                    style={{ width: 200 }}
                    loading={branchesQ.isLoading}
                    options={branchFilterOptions}
                    value={branchId}
                    onChange={(v) => setBranchId(v)}
                  />
                </Space>
                <Table
                  rowKey="id"
                  loading={entriesQ.isLoading}
                  columns={entryColumns}
                  dataSource={rows}
                  pagination={antServerPagination({
                    page,
                    pageSize,
                    total: entryTotal,
                    onChange: (p, ps) => {
                      setPage(p);
                      setPageSize(ps);
                    },
                  })}
                />
              </Card>
            ),
          },
          {
            key: "trial",
            label: "Trial balance",
            children: (
              <Card bordered={false} className="ims-card" loading={trialQ.isLoading}>
                <Row gutter={24}>
                  <Col xs={24} md={12}>
                    <Statistic title="Total debit" value={formatCurrency(tb.debit_total)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Statistic title="Total credit" value={formatCurrency(tb.credit_total)} />
                  </Col>
                </Row>
                <Typography.Paragraph type="secondary" style={{ marginTop: 24 }}>
                  From <Typography.Text code>GET /api/v1/ledger/trial-balance/</Typography.Text>
                </Typography.Paragraph>
              </Card>
            ),
          },
          {
            key: "pl",
            label: "P & L (summary)",
            children: (
              <Card bordered={false} className="ims-card" loading={plQ.isLoading}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Revenue">{formatCurrency(pl.revenue)}</Descriptions.Item>
                  <Descriptions.Item label="COGS">{formatCurrency(pl.cogs)}</Descriptions.Item>
                  <Descriptions.Item label="Expenses">{formatCurrency(pl.expenses)}</Descriptions.Item>
                  <Descriptions.Item label="Net">{formatCurrency(pl.net)}</Descriptions.Item>
                </Descriptions>
                <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
                  Backend returns placeholders until COGS rules are wired. Endpoint:{" "}
                  <Typography.Text code>/ledger/profit-loss/</Typography.Text>
                </Typography.Paragraph>
              </Card>
            ),
          },
          {
            key: "cf",
            label: "Cash flow",
            children: (
              <Card bordered={false} className="ims-card" loading={cfQ.isLoading}>
                <Row gutter={24}>
                  <Col xs={24} md={12}>
                    <Statistic title="Inflows" value={formatCurrency(cf.inflows)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Statistic title="Outflows" value={formatCurrency(cf.outflows)} />
                  </Col>
                </Row>
                <Typography.Paragraph type="secondary" style={{ marginTop: 24 }}>
                  Endpoint: <Typography.Text code>/ledger/cash-flow/</Typography.Text>
                </Typography.Paragraph>
              </Card>
            ),
          },
        ]}
      />
    </PageShell>
  );
}
