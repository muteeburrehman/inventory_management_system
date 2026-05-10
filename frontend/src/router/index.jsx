import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../components/Layout/AppLayout.jsx";
import { DashboardPage } from "../pages/Dashboard/DashboardPage.jsx";
import { LoginPage } from "../pages/Login/LoginPage.jsx";
import { AcceptInvitePage } from "../pages/Auth/AcceptInvitePage.jsx";
import { ForgotPasswordPage } from "../pages/Auth/ForgotPasswordPage.jsx";
import { ResetPasswordPage } from "../pages/Auth/ResetPasswordPage.jsx";
import { ChangePasswordPage } from "../pages/Auth/ChangePasswordPage.jsx";
import { POSPage } from "../pages/POS/POSPage.jsx";
import { ProductsPage } from "../pages/Products/ProductsPage.jsx";
import { ProductFormPage } from "../pages/Products/ProductFormPage.jsx";
import { ProductDetailPage } from "../pages/Products/ProductDetailPage.jsx";
import { CategoriesPage } from "../pages/Categories/CategoriesPage.jsx";
import { BrandsPage } from "../pages/Brands/BrandsPage.jsx";
import { SuppliersPage } from "../pages/Suppliers/SuppliersPage.jsx";
import { CustomersPage } from "../pages/Customers/CustomersPage.jsx";
import { LedgerPage } from "../pages/Ledger/LedgerPage.jsx";
import { BarcodesPage } from "../pages/Barcodes/BarcodesPage.jsx";
import { ExpensesPage } from "../pages/Expenses/ExpensesPage.jsx";
import { InventoryPage } from "../pages/Inventory/InventoryPage.jsx";
import { NotificationsPage } from "../pages/Notifications/NotificationsPage.jsx";
import { PurchasesPage } from "../pages/Purchases/PurchasesPage.jsx";
import { PurchaseReturnsPage } from "../pages/Returns/PurchaseReturnsPage.jsx";
import { SalesReturnsPage } from "../pages/Returns/SalesReturnsPage.jsx";
import { ReportsPage } from "../pages/Reports/ReportsPage.jsx";
import { SettingsPage } from "../pages/Settings/SettingsPage.jsx";
import { UsersPage } from "../pages/Users/UsersPage.jsx";
import { getAccess } from "../api/axios.js";

function ProtectedRoute({ children }) {
  if (!getAccess()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/accept-invite", element: <AcceptInvitePage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "change-password", element: <ChangePasswordPage /> },
      { path: "pos", element: <POSPage /> },
      { path: "products/create", element: <ProductFormPage /> },
      { path: "products/:id/edit", element: <ProductFormPage /> },
      { path: "products/:id", element: <ProductDetailPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "brands", element: <BrandsPage /> },
      { path: "suppliers", element: <SuppliersPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "purchases", element: <PurchasesPage /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "barcodes", element: <BarcodesPage /> },
      { path: "returns/sales", element: <SalesReturnsPage /> },
      { path: "returns/purchases", element: <PurchaseReturnsPage /> },
      { path: "ledger", element: <LedgerPage /> },
      { path: "expenses", element: <ExpensesPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "users", element: <UsersPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "notifications", element: <NotificationsPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
