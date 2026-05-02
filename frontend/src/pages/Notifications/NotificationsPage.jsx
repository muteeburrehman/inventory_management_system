import { useState } from "react";
import { App, Badge, Button, Card, List, Space, Tag, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckOutlined } from "@ant-design/icons";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notifications.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { antServerPagination } from "../../utils/serverPagination.js";

export function NotificationsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["notifications", page, pageSize],
    queryFn: () => listNotifications({ page, page_size: pageSize }),
  });
  const rows = pageData?.results ?? [];
  const total = pageData?.count ?? 0;

  const markOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => message.error("Could not update notification."),
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      message.success("All marked read.");
    },
    onError: () => message.error("Could not mark all read."),
  });

  return (
    <PageShell
      title="Notifications"
      description="Operational alerts: stock, dues, and invoices (PRD §16)."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Alerts" }]}
    >
      <Card
        bordered={false}
        className="ims-card"
        extra={
          <Button icon={<CheckOutlined />} loading={markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
        }
      >
        <List
          loading={isLoading}
          dataSource={rows}
          locale={{ emptyText: "No notifications yet." }}
          pagination={antServerPagination({
            page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          })}
          renderItem={(item) => (
            <List.Item
              actions={
                item.is_read
                  ? []
                  : [
                      <Button type="link" size="small" key="r" onClick={() => markOne.mutate(item.id)}>
                        Mark read
                      </Button>,
                    ]
              }
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>{item.title}</span>
                    {!item.is_read ? <Badge status="processing" /> : <Tag>Read</Tag>}
                    <Tag>{item.notification_type}</Tag>
                  </Space>
                }
                description={
                  <>
                    <Typography.Paragraph style={{ marginBottom: 4 }}>{item.message}</Typography.Paragraph>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {item.created_at}
                    </Typography.Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </PageShell>
  );
}
