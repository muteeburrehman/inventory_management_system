import { App, Button, Card, Form, Input, Typography } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../../api/auth.js";
import { envelopeMessage } from "../../utils/apiErrors.js";

export function ForgotPasswordPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const onFinish = async ({ email }) => {
    try {
      await forgotPassword(email);
      message.success("If an account exists, we sent reset instructions.");
      navigate("/login");
    } catch (e) {
      message.error(envelopeMessage(e));
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
          Forgot password
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Enter your email address. If we find an account, we will send a reset link.
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
            <Input size="large" prefix={<MailOutlined />} autoComplete="email" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block>
            Send reset link
          </Button>
        </Form>
        <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
          <Link to="/login">Back to sign in</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
