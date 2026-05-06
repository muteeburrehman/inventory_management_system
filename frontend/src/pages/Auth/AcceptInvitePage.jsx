import { App, Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { acceptInvite, invitePreflight } from "../../api/auth.js";
import { useQuery } from "@tanstack/react-query";

export function AcceptInvitePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);

  const preQ = useQuery({
    queryKey: ["invite-preflight", token],
    queryFn: () => invitePreflight(token),
    enabled: !!token,
    retry: false,
  });

  const onFinish = async ({ password, password2 }) => {
    if (password !== password2) {
      message.error("Passwords do not match.");
      return;
    }
    try {
      await acceptInvite(token, password);
      message.success("Password set. You can sign in.");
      navigate("/login");
    } catch (e) {
      message.error(e?.response?.data?.message || "Could not complete invitation.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(145deg, #0c1e2e 0%, #0f766e 45%, #134e4a 100%)",
      }}
    >
      <Card variant="borderless" style={{ width: "min(400px, 100%)", borderRadius: 16 }}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Accept invitation
        </Typography.Title>
        {!token && <Typography.Paragraph type="danger">Missing invitation token in URL.</Typography.Paragraph>}
        {token && preQ.isLoading && <Typography.Paragraph>Checking invitation…</Typography.Paragraph>}
        {token && preQ.isError && (
          <Typography.Paragraph type="danger">This invitation link is invalid or expired.</Typography.Paragraph>
        )}
        {token && preQ.isSuccess && (
          <>
            <Typography.Paragraph type="secondary">
              Setting password for <strong>{preQ.data?.username}</strong>
              {preQ.data?.email ? ` (${preQ.data.email})` : ""}.
            </Typography.Paragraph>
            <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
              <Form.Item name="password" label="New password" rules={[{ required: true, min: 8 }]}>
                <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
              <Form.Item name="password2" label="Confirm password" rules={[{ required: true }]}>
                <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block>
                Save password
              </Button>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
}
