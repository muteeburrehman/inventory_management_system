import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RetweetOutlined,
  RightOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { App as AntdApp, theme } from "antd";
import { Avatar, Button, Dropdown, Layout, Menu, Select, Space, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logoutRemote, patchMe } from "../../api/auth.js";
import { listBranches } from "../../api/settings.js";
import { useAuthStore } from "../../store/authStore.js";

const { Header, Sider, Content } = Layout;

/**
 * Sidebar nav, organised as labelled groups (Main / Catalog / Sales / ...) with
 * each group containing either a flat link or a sub-module bundle. This mirrors
 * the modern SaaS layout (Linear / Stripe / Notion) where related items live
 * together under a subtle uppercase section heading.
 */
function buildMenuModel() {
  return [
    {
      type: "group",
      key: "g-main",
      label: "Main",
      children: [
        {
          key: "/",
          icon: <DashboardOutlined />,
          label: <Link to="/">Dashboard</Link>,
          matchPaths: ["/"],
        },
        {
          key: "/pos",
          icon: <ShoppingCartOutlined />,
          label: <Link to="/pos">POS / Billing</Link>,
          matchPaths: ["/pos"],
        },
      ],
    },
    {
      type: "group",
      key: "g-catalog",
      label: "Catalog",
      children: [
        {
          key: "catalog",
          icon: <AppstoreOutlined />,
          label: "Catalog",
          matchPaths: ["/products", "/categories", "/subcategories", "/brands"],
          children: [
            { key: "/products", label: <Link to="/products">Products</Link>, matchPaths: ["/products"] },
            { key: "/categories", label: <Link to="/categories">Categories</Link>, matchPaths: ["/categories"] },
            { key: "/subcategories", label: <Link to="/subcategories">Sub-categories</Link>, matchPaths: ["/subcategories"] },
            { key: "/brands", label: <Link to="/brands">Brands</Link>, matchPaths: ["/brands"] },
          ],
        },
      ],
    },
    {
      type: "group",
      key: "g-trade",
      label: "Trade",
      children: [
        {
          key: "buy",
          icon: <ShopOutlined />,
          label: "Purchasing",
          matchPaths: ["/purchases", "/returns/purchases"],
          children: [
            { key: "/purchases", label: <Link to="/purchases">Purchase orders</Link>, matchPaths: ["/purchases"] },
            { key: "/returns/purchases", label: <Link to="/returns/purchases">Purchase returns</Link>, matchPaths: ["/returns/purchases"] },
          ],
        },
        {
          key: "sell",
          icon: <RetweetOutlined />,
          label: "Sales",
          matchPaths: ["/returns/sales"],
          children: [
            { key: "/returns/sales", label: <Link to="/returns/sales">Sales returns</Link>, matchPaths: ["/returns/sales"] },
          ],
        },
        {
          key: "parties",
          icon: <TeamOutlined />,
          label: "Parties",
          matchPaths: ["/suppliers", "/customers"],
          children: [
            { key: "/suppliers", label: <Link to="/suppliers">Suppliers</Link>, matchPaths: ["/suppliers"] },
            { key: "/customers", label: <Link to="/customers">Customers</Link>, matchPaths: ["/customers"] },
          ],
        },
      ],
    },
    {
      type: "group",
      key: "g-ops",
      label: "Operations",
      children: [
        {
          key: "ops",
          icon: <RetweetOutlined />,
          label: "Inventory",
          matchPaths: ["/inventory", "/barcodes"],
          children: [
            { key: "/inventory", label: <Link to="/inventory">Stock</Link>, matchPaths: ["/inventory"] },
            { key: "/barcodes", label: <Link to="/barcodes">Barcodes</Link>, matchPaths: ["/barcodes"] },
          ],
        },
        {
          key: "fin",
          icon: <CalculatorOutlined />,
          label: "Finance",
          matchPaths: ["/ledger", "/expenses"],
          children: [
            { key: "/ledger", label: <Link to="/ledger">Ledger</Link>, matchPaths: ["/ledger"] },
            { key: "/expenses", label: <Link to="/expenses">Expenses</Link>, matchPaths: ["/expenses"] },
          ],
        },
        {
          key: "/reports",
          icon: <BarChartOutlined />,
          label: <Link to="/reports">Reports</Link>,
          matchPaths: ["/reports"],
        },
      ],
    },
    {
      type: "group",
      key: "g-system",
      label: "System",
      children: [
        {
          key: "admin",
          icon: <SettingOutlined />,
          label: "Administration",
          matchPaths: ["/users", "/settings"],
          children: [
            { key: "/users", label: <Link to="/users">Users</Link>, matchPaths: ["/users"] },
            { key: "/settings", label: <Link to="/settings">Settings</Link>, matchPaths: ["/settings"] },
          ],
        },
        {
          key: "/notifications",
          icon: <BellOutlined />,
          label: <Link to="/notifications">Alerts</Link>,
          matchPaths: ["/notifications"],
        },
      ],
    },
  ];
}

/** Strip our internal `matchPaths` so Ant Design's `Menu` receives a clean tree. */
function stripMatchPaths(items) {
  return items.map((item) => {
    const { matchPaths: _matchPaths, ...rest } = item;
    if (Array.isArray(rest.children)) {
      rest.children = stripMatchPaths(rest.children);
    }
    return rest;
  });
}

/** Pick the active leaf key + all ancestor sub-menu keys for the current URL. */
function resolveActiveKeys(model, pathname) {
  const selected = [];
  const openKeys = [];
  const isMatch = (paths) => {
    if (!Array.isArray(paths)) return false;
    for (const p of paths) {
      if (p === "/") {
        if (pathname === "/") return true;
      } else if (pathname === p || pathname.startsWith(`${p}/`)) {
        return true;
      }
    }
    return false;
  };
  const walk = (items, parents) => {
    for (const item of items) {
      if (Array.isArray(item.children) && item.type !== "group") {
        if (isMatch(item.matchPaths)) {
          openKeys.push(item.key);
          walk(item.children, [...parents, item.key]);
        } else {
          walk(item.children, [...parents, item.key]);
        }
      } else if (item.type === "group" && Array.isArray(item.children)) {
        walk(item.children, parents);
      } else if (isMatch(item.matchPaths)) {
        selected.push(item.key);
        openKeys.push(...parents);
      }
    }
  };
  walk(model, []);
  return { selected, openKeys: Array.from(new Set(openKeys)) };
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { token } = theme.useToken();
  const qc = useQueryClient();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("ims.sidebar.collapsed") === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ims.sidebar.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const menuModel = useMemo(() => buildMenuModel(), []);
  const cleanedItems = useMemo(() => stripMatchPaths(menuModel), [menuModel]);

  const { selected: selectedKeys, openKeys: defaultOpen } = useMemo(
    () => resolveActiveKeys(menuModel, location.pathname),
    [menuModel, location.pathname],
  );

  // openKeys is controlled so we can auto-expand the group containing the active
  // page on navigation, while still letting the user manually open/close groups.
  const [openKeys, setOpenKeys] = useState(defaultOpen);
  useEffect(() => {
    setOpenKeys((prev) => {
      const merged = new Set(prev);
      for (const k of defaultOpen) merged.add(k);
      return Array.from(merged);
    });
  }, [defaultOpen]);

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
  const allowedIds = new Set(
    fromMe.length ? fromMe : user?.branch?.id != null ? [user.branch.id] : [],
  );
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

  const appName = import.meta.env.VITE_APP_NAME || "Inventory System";
  const sidebarWidth = 264;
  const collapsedWidth = 72;

  const userMenu = {
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
      if (key === "out") await onSignOut();
    },
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={sidebarWidth}
        collapsedWidth={collapsedWidth}
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        onBreakpoint={(broken) => {
          // Auto-collapse on small screens so the content area never gets squashed.
          if (broken) setCollapsed(true);
        }}
        className="ims-sider"
        style={{
          background: "var(--ims-sidebar)",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          zIndex: 30,
        }}
      >
        <div className="ims-sider__inner">
          <div className={`ims-sider__brand ${collapsed ? "is-collapsed" : ""}`}>
            <Tooltip
              title={collapsed ? appName : undefined}
              placement="right"
              mouseEnterDelay={0.4}
            >
              <Link
                to="/"
                className="ims-sider__brand-link"
                aria-label={`${appName} — go to dashboard`}
              >
                <span className="ims-sider__brand-mark" aria-hidden>
                  {/* small monogram so the collapsed bar still has identity */}
                  <span>{(appName || "IMS").slice(0, 1).toUpperCase()}</span>
                </span>
                {!collapsed && (
                  <span className="ims-sider__brand-text">
                    <span className="ims-sider__brand-title" title={appName}>
                      {appName}
                    </span>
                    <span className="ims-sider__brand-sub">Billing &amp; stock</span>
                  </span>
                )}
              </Link>
            </Tooltip>
          </div>

          <div className="ims-sider__menuwrap">
            <Menu
              theme="dark"
              mode="inline"
              inlineCollapsed={collapsed}
              selectedKeys={selectedKeys}
              openKeys={collapsed ? [] : openKeys}
              onOpenChange={(keys) => setOpenKeys(keys)}
              style={{ background: "transparent", border: "none" }}
              items={cleanedItems}
              expandIcon={({ isOpen }) => (
                <RightOutlined
                  className="ims-sider__chevron"
                  style={{
                    fontSize: 11,
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                  }}
                />
              )}
            />
          </div>

          <div className={`ims-sider__footer ${collapsed ? "is-collapsed" : ""}`}>
            <Dropdown menu={userMenu} placement={collapsed ? "topRight" : "topLeft"} trigger={["click"]}>
              <button type="button" className="ims-sider__user" aria-label="Account menu">
                <Avatar size={32} icon={<UserOutlined />} />
                {!collapsed && (
                  <span className="ims-sider__user-text">
                    <span className="ims-sider__user-name">{user?.username ?? "User"}</span>
                    <span className="ims-sider__user-role">
                      {user?.role || (user?.is_superuser ? "Super admin" : "Member")}
                    </span>
                  </span>
                )}
              </button>
            </Dropdown>
          </div>
        </div>
      </Sider>

      <Layout>
        <Header
          className="ims-header"
          style={{
            background: token.colorBgContainer,
            padding: "0 24px",
            height: 60,
            lineHeight: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <Space size={12} align="center">
            <Button
              type="text"
              className="ims-header__toggle"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((v) => !v)}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            />
          </Space>
          <Space size={12} wrap>
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
                  const branchMsg = Array.isArray(fieldErr)
                    ? fieldErr[0]
                    : typeof fieldErr === "string"
                      ? fieldErr
                      : null;
                  const errMsg =
                    branchMsg ||
                    (d && typeof d === "object" && (d.message || d.detail)) ||
                    e?.message ||
                    "Could not update branch.";
                  message.error(typeof errMsg === "string" ? errMsg : "Could not update branch.");
                }
              }}
            />
          </Space>
        </Header>

        <Content style={{ margin: "24px 28px 32px", minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
