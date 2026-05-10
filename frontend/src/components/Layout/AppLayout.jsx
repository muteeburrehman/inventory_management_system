import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  KeyOutlined,
  LogoutOutlined,
  RetweetOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { theme, App as AntdApp } from "antd";
import { Layout, Menu, Space, Dropdown, Button, Avatar, Select } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logoutRemote, patchMe } from "../../api/auth.js";
import { listBranches } from "../../api/settings.js";
import { useAuthStore } from "../../store/authStore.js";

const { Header, Sider, Content } = Layout;

function menuItems() {
  return [
    { key: "/", icon: <DashboardOutlined />, label: <Link to="/">Dashboard</Link> },
    { key: "/pos", icon: <ShoppingCartOutlined />, label: <Link to="/pos">POS / Billing</Link> },
    {
      key: "cat",
      icon: <AppstoreOutlined />,
      label: "Catalog",
      children: [
        { key: "/products", label: <Link to="/products">Products</Link> },
        { key: "/categories", label: <Link to="/categories">Categories</Link> },
        { key: "/brands", label: <Link to="/brands">Brands</Link> },
      ],
    },
    {
      key: "parties",
      icon: <TeamOutlined />,
      label: "Parties",
      children: [
        { key: "/suppliers", label: <Link to="/suppliers">Suppliers</Link> },
        { key: "/customers", label: <Link to="/customers">Customers</Link> },
      ],
    },
    {
      key: "buy",
      icon: <ShopOutlined />,
      label: "Purchasing",
      children: [{ key: "/purchases", label: <Link to="/purchases">Purchase orders</Link> }],
    },
    {
      key: "ops",
      icon: <RetweetOutlined />,
      label: "Operations",
      children: [
        { key: "/inventory", label: <Link to="/inventory">Inventory</Link> },
        { key: "/barcodes", label: <Link to="/barcodes">Barcodes</Link> },
      ],
    },
    {
      key: "ret",
      icon: <RetweetOutlined />,
      label: "Returns",
      children: [
        { key: "/returns/sales", label: <Link to="/returns/sales">Sales returns</Link> },
        { key: "/returns/purchases", label: <Link to="/returns/purchases">Purchase returns</Link> },
      ],
    },
    {
      key: "fin",
      icon: <CalculatorOutlined />,
      label: "Finance",
      children: [
        { key: "/ledger", label: <Link to="/ledger">Ledger</Link> },
        { key: "/expenses", label: <Link to="/expenses">Expenses</Link> },
      ],
    },
    { key: "/reports", icon: <BarChartOutlined />, label: <Link to="/reports">Reports</Link> },
    {
      key: "admin",
      icon: <SettingOutlined />,
      label: "Administration",
      children: [
        { key: "/users", label: <Link to="/users">Users</Link> },
        { key: "/settings", label: <Link to="/settings">Settings</Link> },
      ],
    },
    { key: "/notifications", icon: <BellOutlined />, label: <Link to="/notifications">Alerts</Link> },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      danger: true,
    },
  ];
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { token } = theme.useToken();
  const qc = useQueryClient();

  const branchesQ = useQuery({
    queryKey: ["branches", "header"],
    queryFn: () => listBranches({ page_size: 100 }),
  });
  const branchRows = branchesQ.data?.results ?? [];
  const branchOptions = branchRows
    .filter((b) => b.is_active !== false || b.id === user?.branch?.id)
    .map((b) => ({
      value: b.id,
      label: b.is_active === false ? `${b.name} (inactive)` : b.name,
    }));

  const fromMe = (user?.branches ?? []).map((b) => b.id);
  const allowedIds = new Set(fromMe.length ? fromMe : user?.branch?.id != null ? [user.branch.id] : []);
  const canSeeAll =
    Boolean(user?.is_superuser) || user?.role === "super_admin" || user?.role === "owner";
  const branchChoices = canSeeAll
    ? branchOptions
    : allowedIds.size
      ? branchOptions.filter((o) => allowedIds.has(o.value))
      : [];

  const onSignOut = async () => {
    await logoutRemote();
    useAuthStore.getState().clear();
    navigate("/login");
  };

  const onMenuClick = ({ key }) => {
    if (key === "logout") {
      onSignOut();
    }
  };

  const appName = import.meta.env.VITE_APP_NAME || "Inventory System";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={248}
        breakpoint="lg"
        collapsedWidth={0}
        className="ims-sider"
        style={{ background: "var(--ims-sidebar)" }}
      >
        <div className="ims-logo">
          {appName}
          <small>Billing &amp; stock</small>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={["cat", "parties", "buy", "ops", "ret", "fin", "admin"]}
          style={{ background: "transparent", flex: 1, border: "none" }}
          items={menuItems()}
          onClick={onMenuClick}
        />
      </Sider>
      <Layout>
        <Header className="ims-header" style={{ background: token.colorBgContainer, padding: "0 28px", height: 64, lineHeight: "64px" }}>
          <Space style={{ width: "100%", justifyContent: "flex-end" }} wrap>
            <Select
              allowClear
              placeholder="Select your branch"
              style={{ minWidth: 220 }}
              loading={branchesQ.isLoading}
              options={branchChoices}
              disabled={!branchChoices.length && !branchesQ.isLoading}
              value={user?.branch?.id ?? undefined}
              onChange={async (branchId) => {
                try {
                  const me = await patchMe({ branch: branchId ?? null });
                  setUser(me);
                  qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
                  message.success(branchId ? "Branch updated." : "Branch cleared.");
                } catch (e) {
                  const d = e?.response?.data;
                  const fieldErr = d?.errors?.branch;
                  const branchMsg = Array.isArray(fieldErr) ? fieldErr[0] : typeof fieldErr === "string" ? fieldErr : null;
                  const errMsg =
                    branchMsg ||
                    (d && typeof d === "object" && (d.message || d.detail)) ||
                    e?.message ||
                    "Could not update branch.";
                  message.error(typeof errMsg === "string" ? errMsg : "Could not update branch.");
                }
              }}
            />
            <Dropdown
              menu={{
                items: [
                  {
                    key: "pw",
                    label: <Link to="/change-password">Change password</Link>,
                    icon: <KeyOutlined />,
                  },
                  { type: "divider" },
                  { key: "out", danger: true, label: "Sign out", icon: <LogoutOutlined /> },
                ],
                onClick: async ({ key }) => {
                  if (key === "out") {
                    await onSignOut();
                  }
                },
              }}
            >
              <Button type="text" icon={<Avatar size="small" icon={<UserOutlined />} />} style={{ height: 40 }}>
                {user?.username ?? "User"}
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: "24px 28px 32px", minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
