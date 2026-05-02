import { App, Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { login, fetchMe } from "../../api/auth.js";
import { useAuthStore } from "../../store/authStore.js";

export function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const onFinish = async (values) => {
    try {
      await login(values.username, values.password);
      const me = await fetchMe();
      setUser(me);
      message.success("Welcome back.");
      navigate("/");
    } catch (e) {
      const d = e?.response?.data;
      const errMsg =
        (d && typeof d === "object" && (d.message || d.detail)) ||
        (typeof d === "string" && d.slice(0, 200)) ||
        e?.message ||
        "Login failed.";
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
      </Card>
    </div>
  );
}
