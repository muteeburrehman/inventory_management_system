import { App, Alert, Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, fetchMe } from "../../api/auth.js";
import { useAuthStore } from "../../store/authStore.js";
import { envelopeMessage } from "../../utils/apiErrors.js";

export function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [loginError, setLoginError] = useState(null);

  const onFinish = async (values) => {
    setLoginError(null);
    try {
      const envelope = await login(values.username, values.password);
      const me = await fetchMe();
      setUser(me);
      if (envelope.must_change_password || me?.must_change_password) {
        message.info("Please set a new password to continue.");
        navigate("/change-password");
        return;
      }
      message.success("Welcome back.");
      navigate("/");
    } catch (e) {
      const errMsg = envelopeMessage(e);
      setLoginError(errMsg);
      message.error(errMsg);
    }
  };

  const appName = import.meta.env.VITE_APP_NAME || "Inventory System";

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
      <Card
        variant="borderless"
        style={{
          width: "min(400px, 100%)",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
        }}
      >
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
          {appName}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 28 }}>
          Inventory, billing, and ledger — sign in to continue.
        </Typography.Paragraph>
        {loginError ? (
          <Alert type="error" showIcon style={{ marginBottom: 16 }} message={loginError} closable onClose={() => setLoginError(null)} />
        ) : null}
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="username" label="Username or email" rules={[{ required: true }]}>
            <Input size="large" prefix={<UserOutlined />} autoComplete="username" placeholder="you@company.com" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block>
            Sign in
          </Button>
        </Form>
        <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
