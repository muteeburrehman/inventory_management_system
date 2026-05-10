import { Button, Modal } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";

/**
 * Standard delete confirmation modal used across the app.
 */
export function ConfirmDeleteButton({
  title = "Are you sure you want to delete?",
  description = "This action cannot be undone.",
  onConfirm,
  children = "Delete",
  okText = "Delete",
  cancelText = "Cancel",
  loading = false,
  disabled = false,
  danger = true,
  type = "link",
  size = "small",
  icon,
}) {
  const openConfirm = () => {
    Modal.confirm({
      title,
      icon: <ExclamationCircleOutlined />,
      content: description,
      okText,
      cancelText,
      okButtonProps: { danger: true },
      // Return a promise so the modal waits, shows loading, and surfaces rejections (e.g. network errors).
      onOk: () => Promise.resolve(onConfirm ? onConfirm() : undefined),
    });
  };

  return (
    <Button
      type={type}
      size={size}
      danger={danger}
      icon={icon}
      loading={loading}
      disabled={disabled}
      onClick={openConfirm}
    >
      {children}
    </Button>
  );
}
