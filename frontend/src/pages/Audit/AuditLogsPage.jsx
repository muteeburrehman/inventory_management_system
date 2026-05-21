import { useState } from "react";
import { Button, Card, Space, Table, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { getAccess } from "../../api/axios.js";
import { backupExportUrl, listAuditLogs } from "../../api/audit.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { antServerPagination } from "../../utils/serverPagination.js";

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const logsQ = useQuery({
    queryKey: ["audit-logs", page, pageSize],
    queryFn: () => listAuditLogs({ page, page_size: pageSize }),
  });

  const downloadBackup = async () => {
    const token = getAccess();
    const res = await fetch(backupExportUrl(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ims-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { title: "When", dataIndex: "timestamp", width: 180 },
    { title: "User", dataIndex: "username", width: 120 },
    { title: "Action", dataIndex: "action", width: 90 },
    { title: "Module", dataIndex: "module", width: 100 },
    { title: "Description", dataIndex: "description", ellipsis: true },
    { title: "IP", dataIndex: "ip_address", width: 120 },
  ];

  return (
    <PageShell
      title="Audit logs"
      description="Login history and API mutations for accountability."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Administration" }, { title: "Audit logs" }]}
    >
      <Card bordered={false} className="ims-card" style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={() => downloadBackup().catch(() => {})}>
            Export backup (JSON)
          </Button>
          <Typography.Text type="secondary">
            Owner / super admin only. Includes products, parties, sales, purchases, ledger.
          </Typography.Text>
        </Space>
      </Card>
      <Table
        rowKey="id"
        loading={logsQ.isLoading}
        columns={columns}
        dataSource={logsQ.data?.results ?? []}
        pagination={antServerPagination({
          page,
          pageSize,
          total: logsQ.data?.count ?? 0,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        })}
      />
    </PageShell>
  );
}
