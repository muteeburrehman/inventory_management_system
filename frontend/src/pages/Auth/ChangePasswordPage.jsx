import { App, Button, Card, Form, Input } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../../api/auth.js";
import { getRefresh, clearTokens } from "../../api/axios.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { useAuthStore } from "../../store/authStore.js";
import { applyDrfFieldErrors, envelopeMessage } from "../../utils/apiErrors.js";

export function ChangePasswordPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const clearUser = useAuthStore((s) => s.clear);
  const [form] = Form.useForm();

  const onFinish = async ({ old_password: oldPassword, password, password2 }) => {
    if (password !== password2) {
      message.error("New passwords do not match.");
      return;
    }
    try {
      await changePassword(oldPassword, password, getRefresh());
      clearTokens();
      clearUser();
      message.success("Password updated. Please sign in again.");
      navigate("/login");
    } catch (e) {
      if (!applyDrfFieldErrors(form, e)) {
        message.error(envelopeMessage(e));
      }
    }
  };

  return (
    <PageShell
      title="Change password"
      description="For security, you will be signed out everywhere after this."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Change password" }]}
    >
      <Card bordered={false} className="ims-card" style={{ maxWidth: 440 }}>
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="old_password" label="Current password" rules={[{ required: true, message: "Enter your current password" }]}>
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="password"
            label="New password"
            rules={[
              { required: true, message: "Enter a new password" },
              { min: 8, message: "Use at least 8 characters" },
            ]}
          >
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="password2" label="Confirm new password" rules={[{ required: true, message: "Confirm your new password" }]}>
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>
          <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" size="large" block>
              Update password
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </PageShell>
  );
}
