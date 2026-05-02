from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import (
    LoginView,
    PermissionListUpdateAPI,
    RefreshView,
    UserViewSet,
    logout_view,
    me_view,
)
from apps.barcodes.views import generate_barcode, lookup_barcode
from apps.customers.views import CustomerViewSet
from apps.dashboard.views import dashboard_summary
from apps.expenses.views import ExpenseCategoryViewSet, ExpenseViewSet
from apps.inventory.views import InventoryViewSet
from apps.ledger.views import LedgerViewSet
from apps.notifications.views import NotificationViewSet
from apps.products.views import BrandViewSet, CategoryViewSet, ProductViewSet
from apps.purchases.views import PurchaseViewSet
from apps.reports.views import (
    day_closing_report,
    due_payments_report,
    expenses_report,
    inventory_report,
    profit_report,
    purchases_report,
    sales_report,
)
from apps.sales.views import CouponViewSet, SaleViewSet
from apps.settings_app.views import (
    BranchViewSet,
    BusinessSettingsAPIView,
    shift_close,
    shift_open,
)
from apps.suppliers.views import SupplierViewSet

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"products", ProductViewSet, basename="product")
router.register(r"suppliers", SupplierViewSet, basename="supplier")
router.register(r"customers", CustomerViewSet, basename="customer")
router.register(r"purchases", PurchaseViewSet, basename="purchase")
router.register(r"sales", SaleViewSet, basename="sale")
router.register(r"ledger", LedgerViewSet, basename="ledger")
router.register(r"expenses", ExpenseViewSet, basename="expense")
router.register(r"settings/branches", BranchViewSet, basename="branch")
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", logout_view, name="auth-logout"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("auth/me/", me_view, name="auth-me"),
    path("users/permissions/", PermissionListUpdateAPI.as_view(), name="user-permissions"),
    path(
        "products/categories/",
        CategoryViewSet.as_view({"get": "list", "post": "create"}),
        name="product-category-list",
    ),
    path(
        "products/categories/<int:pk>/",
        CategoryViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
        name="product-category-detail",
    ),
    path(
        "products/brands/",
        BrandViewSet.as_view({"get": "list", "post": "create"}),
        name="product-brand-list",
    ),
    path(
        "products/brands/<int:pk>/",
        BrandViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
        name="product-brand-detail",
    ),
    path(
        "sales/coupons/",
        CouponViewSet.as_view({"get": "list", "post": "create"}),
        name="sales-coupon-list",
    ),
    path("sales/hold/", SaleViewSet.as_view({"post": "hold"}), name="sales-hold"),
    path("sales/held/", SaleViewSet.as_view({"get": "held"}), name="sales-held"),
    path(
        "inventory/stock/",
        InventoryViewSet.as_view({"get": "stock"}),
        name="inventory-stock",
    ),
    path(
        "inventory/adjustment/",
        InventoryViewSet.as_view({"post": "adjustment"}),
        name="inventory-adjustment",
    ),
    path(
        "inventory/transfer/",
        InventoryViewSet.as_view({"post": "transfer"}),
        name="inventory-transfer",
    ),
    path(
        "inventory/movements/",
        InventoryViewSet.as_view({"get": "movements"}),
        name="inventory-movements",
    ),
    path("expenses/categories/", ExpenseCategoryViewSet.as_view({"get": "list", "post": "create"})),
    path(
        "expenses/categories/<int:pk>/",
        ExpenseCategoryViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
    ),
    path("reports/sales/", sales_report),
    path("reports/purchases/", purchases_report),
    path("reports/inventory/", inventory_report),
    path("reports/profit/", profit_report),
    path("reports/expenses/", expenses_report),
    path("reports/due-payments/", due_payments_report),
    path("reports/day-closing/", day_closing_report),
    path("dashboard/summary/", dashboard_summary),
    path("settings/business/", BusinessSettingsAPIView.as_view(), name="settings-business"),
    path("settings/shift/open/", shift_open),
    path("settings/shift/close/", shift_close),
    path("barcodes/lookup/", lookup_barcode),
    path("barcodes/generate/", generate_barcode),
    path("", include(router.urls)),
]
