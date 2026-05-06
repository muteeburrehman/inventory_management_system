import { App, Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMemo } from "react";
import { resetPassword } from "../../api/auth.js";

export function ResetPasswordPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);

  const onFinish = async ({ password, password2 }) => {
    if (password !== password2) {
      message.error("Passwords do not match.");
      return;
    }
    try {
      await resetPassword(token, password);
      message.success("Password updated. Sign in with your new password.");
      navigate("/login");
    } catch (e) {
      message.error(e?.response?.data?.message || "Reset failed.");
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
          Reset password
        </Typography.Title>
        {!token && <Typography.Paragraph type="danger">Missing reset token.</Typography.Paragraph>}
        {token && (
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item name="password" label="New password" rules={[{ required: true, min: 8 }]}>
              <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="password2" label="Confirm password" rules={[{ required: true }]}>
              <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block>
              Update password
            </Button>
          </Form>
        )}
        <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
          <Link to="/login">Back to sign in</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
