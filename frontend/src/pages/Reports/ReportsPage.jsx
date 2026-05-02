import { useState } from "react";
import { App, Button, Card, DatePicker, Space, Table, Tabs, Typography } from "antd";
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

function KeyTable({ data }) {
  if (data == null) return <Typography.Text type="secondary">Load a report.</Typography.Text>;
  const rows = Object.entries(data).map(([key, value]) => ({
    key,
    value: typeof value === "object" ? JSON.stringify(value) : String(value),
  }));
  return <Table size="small" rowKey="key" pagination={false} columns={[{ title: "Field", dataIndex: "key" }, { title: "Value", dataIndex: "value" }]} dataSource={rows} />;
}

export function ReportsPage() {
  const { message } = App.useApp();
  const [range, setRange] = useState([]);
  const [sales, setSales] = useState(null);
  const [purchases, setPurchases] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [profit, setProfit] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [due, setDue] = useState(null);
  const [closing, setClosing] = useState(null);
  const [loading, setLoading] = useState(null);

  const params = {};
  if (range?.[0] && range?.[1]) {
    params.date_from = range[0].format("YYYY-MM-DD");
    params.date_to = range[1].format("YYYY-MM-DD");
  }

  const load = async (name, fn, setter) => {
    setLoading(name);
    try {
      const res = await fn(params);
      setter(res);
    } catch {
      message.error("Could not load report.");
      setter(null);
    } finally {
      setLoading(null);
    }
  };

  const tabItems = [
    {
      key: "sales",
      label: "Sales",
      children: (
        <Card className="ims-card" extra={<Button loading={loading === "s"} onClick={() => load("s", salesReport, setSales)}>Refresh</Button>}>
          <KeyTable data={sales} />
        </Card>
      ),
    },
    {
      key: "pur",
      label: "Purchases",
      children: (
        <Card className="ims-card" extra={<Button loading={loading === "p"} onClick={() => load("p", purchasesReport, setPurchases)}>Refresh</Button>}>
          <KeyTable data={purchases} />
        </Card>
      ),
    },
    {
      key: "inv",
      label: "Inventory",
      children: (
        <Card className="ims-card" extra={<Button loading={loading === "i"} onClick={() => load("i", inventoryReport, setInventory)}>Refresh</Button>}>
          <KeyTable data={inventory} />
        </Card>
      ),
    },
    {
      key: "profit",
      label: "Profit",
      children: (
        <Card className="ims-card" extra={<Button loading={loading === "pr"} onClick={() => load("pr", profitReport, setProfit)}>Refresh</Button>}>
          <KeyTable data={profit} />
        </Card>
      ),
    },
    {
      key: "exp",
      label: "Expenses",
      children: (
        <Card className="ims-card" extra={<Button loading={loading === "e"} onClick={() => load("e", expensesReport, setExpenses)}>Refresh</Button>}>
          <KeyTable data={expenses} />
        </Card>
      ),
    },
    {
      key: "due",
      label: "Due payments",
      children: (
        <Card className="ims-card" extra={<Button loading={loading === "d"} onClick={() => load("d", duePaymentsReport, setDue)}>Refresh</Button>}>
          <KeyTable data={due} />
        </Card>
      ),
    },
    {
      key: "day",
      label: "Day closing",
      children: (
        <Card className="ims-card" extra={<Button loading={loading === "c"} onClick={() => load("c", dayClosingReport, setClosing)}>Refresh</Button>}>
          <KeyTable data={closing} />
        </Card>
      ),
    },
  ];

  return (
    <PageShell
      title="Reports"
      description="Summary endpoints per PRD §15. Backend stubs return minimal JSON until analytics are expanded; use Refresh on each tab. Optional date range:"
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Insights" }, { title: "Reports" }]}
    >
      <Space style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker value={range} onChange={setRange} />
      </Space>
      <Tabs items={tabItems} />
    </PageShell>
  );
}
