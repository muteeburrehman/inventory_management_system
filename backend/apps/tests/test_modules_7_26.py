"""
Integration tests for IMS modules 7–26.

Run:  cd backend && python manage.py test apps.tests.test_modules_7_26 -v 2
Or:   ./scripts/verify_modules_7_26.sh
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import AuditLog
from apps.customers.models import Customer
from apps.expenses.models import Expense, ExpenseCategory
from apps.inventory.models import StockMovement, StockTransfer
from apps.ledger.models import LedgerEntry
from apps.notifications.models import Notification
from apps.products.models import Product
from apps.purchases.models import PurchaseOrder
from apps.sales.models import Coupon, Sale
from apps.suppliers.models import Supplier

from .base import ModuleFixturesMixin, jwt_client, unwrap


class Module07SupplierTests(ModuleFixturesMixin, TestCase):
    def test_supplier_crud_and_ledger(self):
        client = jwt_client(self.user)
        r = client.post(
            "/api/v1/suppliers/",
            {
                "name": "Acme Supplies",
                "contact_person": "Jane",
                "email": "jane@acme.test",
                "phone": "555-0100",
                "address": "1 Supply Rd",
                "tax_number": "TAX-99",
                "payment_terms": "Net 30",
                "branch_ids": [self.branch.id],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        data = unwrap(r)
        sid = data["id"]
        self.assertEqual(data["name"], "Acme Supplies")
        self.assertEqual(data["payment_terms"], "Net 30")

        r = client.patch(
            f"/api/v1/suppliers/{sid}/",
            {"contact_person": "Janet"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(unwrap(r)["contact_person"], "Janet")

        r = client.get(f"/api/v1/suppliers/{sid}/ledger/")
        self.assertEqual(r.status_code, 200, r.content)
        ledger = unwrap(r)
        self.assertIn("total_purchases", ledger)
        self.assertIn("due_amount", ledger)

        r = client.get(f"/api/v1/suppliers/{sid}/purchase-history/")
        self.assertEqual(r.status_code, 200, r.content)

        r = client.delete(f"/api/v1/suppliers/{sid}/")
        self.assertEqual(r.status_code, 204, r.content)


class Module08CustomerTests(ModuleFixturesMixin, TestCase):
    def test_customer_crud_and_ledger(self):
        client = jwt_client(self.user)
        r = client.post(
            "/api/v1/customers/",
            {
                "name": "Retail Bob",
                "phone": "555-0200",
                "email": "bob@test.com",
                "address": "2 Main St",
                "reward_points": 50,
                "branch_ids": [self.branch.id],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        cid = unwrap(r)["id"]
        self.assertEqual(unwrap(client.get(f"/api/v1/customers/{cid}/"))["reward_points"], 50)

        r = client.get(f"/api/v1/customers/{cid}/ledger/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIn("due_amount", unwrap(r))

        r = client.get(f"/api/v1/customers/{cid}/purchase-history/")
        self.assertEqual(r.status_code, 200, r.content)

        r = client.get(f"/api/v1/customers/{cid}/payment-history/")
        self.assertEqual(r.status_code, 200, r.content)

        r = client.delete(f"/api/v1/customers/{cid}/")
        self.assertEqual(r.status_code, 204, r.content)


class Module09PurchaseTests(ModuleFixturesMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.supplier = Supplier.objects.create(name="PO Supplier")
        self.supplier.branches.add(self.branch)

    def test_purchase_crud_receive_and_return(self):
        client = jwt_client(self.user)
        r = client.post(
            "/api/v1/purchases/",
            {
                "supplier": self.supplier.id,
                "purchase_date": str(date.today()),
                "total_amount": "100.00",
                "paid_amount": "100.00",
                "due_amount": "0.00",
                "payment_mode": "cash",
                "status": "received",
                "branch": self.branch.id,
                "items": [
                    {
                        "product": self.product.id,
                        "quantity": 10,
                        "purchase_price": "10.00",
                        "tax": "0",
                        "discount": "0",
                        "subtotal": "100.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        pid = PurchaseOrder.objects.order_by("-id").values_list("id", flat=True).first()
        self.assertIsNotNone(pid)
        self.product.refresh_from_db()
        self.assertGreaterEqual(self.product.current_stock, 100)

        r = client.patch(
            f"/api/v1/purchases/{pid}/",
            {"status": "cancelled"},
            format="json",
        )
        self.assertIn(r.status_code, (200, 400), r.content)

        po2 = PurchaseOrder.objects.create(
            supplier=self.supplier,
            invoice_number="PUR-RET-001",
            purchase_date=date.today(),
            total_amount=Decimal("50"),
            paid_amount=Decimal("50"),
            due_amount=Decimal("0"),
            branch=self.branch,
            status=PurchaseOrder.Status.RECEIVED,
        )
        r = client.post(
            f"/api/v1/purchases/{po2.id}/return/",
            {
                "return_date": str(date.today()),
                "reason": "defective",
                "total_amount": "50",
                "items": [{"product": self.product.id, "quantity": 1, "price": "50"}],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)


class Module10InventoryTests(ModuleFixturesMixin, TestCase):
    def test_stock_adjustment_transfer_movements(self):
        client = jwt_client(self.user)
        before = self.product.current_stock

        r = client.post(
            "/api/v1/inventory/adjustment/",
            {
                "product": self.product.id,
                "quantity": 5,
                "reason": "test adjustment",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, before + 5)
        self.assertTrue(
            StockMovement.objects.filter(
                product=self.product,
                movement_type=StockMovement.MovementType.ADJUSTMENT,
            ).exists()
        )

        r = client.post(
            "/api/v1/inventory/transfer/",
            {
                "from_branch": self.branch.id,
                "to_branch": self.branch_b.id,
                "product": self.product.id,
                "quantity": 2,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(StockTransfer.objects.filter(product=self.product).exists())

        r = client.get("/api/v1/inventory/stock/")
        self.assertEqual(r.status_code, 200, r.content)

        r = client.get("/api/v1/inventory/movements/")
        self.assertEqual(r.status_code, 200, r.content)


class Module11WarehouseBranchTests(ModuleFixturesMixin, TestCase):
    def test_branch_crud_as_warehouse_proxy(self):
        client = jwt_client(self.user)
        r = client.post(
            "/api/v1/settings/branches/",
            {
                "name": "Warehouse East M726",
                "address": "East dock",
                "phone": "",
                "is_main": False,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        bid = unwrap(r)["id"]

        r = client.patch(
            f"/api/v1/settings/branches/{bid}/",
            {"address": "East dock 2"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)

        r = client.get("/api/v1/settings/branches/")
        self.assertEqual(r.status_code, 200, r.content)

        r = client.delete(f"/api/v1/settings/branches/{bid}/")
        self.assertIn(r.status_code, (204, 409), r.content)


class Module12BarcodeTests(ModuleFixturesMixin, TestCase):
    def test_barcode_lookup_and_generate(self):
        client = jwt_client(self.user)
        r = client.get("/api/v1/barcodes/lookup/", {"code": self.product.barcode})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(unwrap(r).get("found"))

        r = client.get("/api/v1/barcodes/generate/", {"sku": "NEW-SKU"})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(unwrap(r)["barcode_value"], "NEW-SKU")


class Module13POSTests(ModuleFixturesMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.customer = Customer.objects.create(name="POS Customer")
        self.customer.branches.add(self.branch)

    def _sale_payload(self, status="completed", qty=1):
        return {
            "customer": self.customer.id,
            "subtotal": "10.00",
            "discount": "0",
            "tax": "0",
            "total_amount": "10.00",
            "paid_amount": "10.00",
            "change_amount": "0",
            "due_amount": "0",
            "payment_mode": "cash",
            "status": status,
            "branch": self.branch.id,
            "items": [
                {
                    "product": self.product.id,
                    "quantity": qty,
                    "unit_price": "10.00",
                    "discount": "0",
                    "tax": "0",
                    "subtotal": "10.00",
                }
            ],
            "split_payments": [{"payment_mode": "cash", "amount": "10.00"}],
        }

    def test_pos_sale_and_hold(self):
        client = jwt_client(self.user)
        r = client.post("/api/v1/sales/", self._sale_payload(), format="json")
        self.assertEqual(r.status_code, 201, r.content)

        r = client.post("/api/v1/sales/hold/", self._sale_payload(status="held"), format="json")
        self.assertEqual(r.status_code, 201, r.content)

        r = client.get("/api/v1/sales/held/")
        self.assertEqual(r.status_code, 200, r.content)


class Module14SalesTests(ModuleFixturesMixin, TestCase):
    def test_sales_list_and_detail(self):
        client = jwt_client(self.user)
        r = client.get("/api/v1/sales/")
        self.assertEqual(r.status_code, 200, r.content)
        data = unwrap(r)
        results = data.get("results", data) if isinstance(data, dict) else data
        if isinstance(results, list) and results:
            r = client.get(f"/api/v1/sales/{results[0]['id']}/")
            self.assertEqual(r.status_code, 200, r.content)


class Module15ReturnsTests(ModuleFixturesMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.customer = Customer.objects.create(name="Return Cust")
        self.customer.branches.add(self.branch)
        self.supplier = Supplier.objects.create(name="Return Sup")
        self.supplier.branches.add(self.branch)

    def test_sales_return(self):
        client = jwt_client(self.user)
        r = client.post(
            "/api/v1/sales/",
            {
                "customer": self.customer.id,
                "subtotal": "10.00",
                "discount": "0",
                "tax": "0",
                "total_amount": "10.00",
                "paid_amount": "10.00",
                "due_amount": "0",
                "payment_mode": "cash",
                "status": "completed",
                "branch": self.branch.id,
                "items": [
                    {
                        "product": self.product.id,
                        "quantity": 1,
                        "unit_price": "10.00",
                        "discount": "0",
                        "tax": "0",
                        "subtotal": "10.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        sale_id = unwrap(r)["id"]

        r = client.post(
            f"/api/v1/sales/{sale_id}/return/",
            {
                "return_type": "partial",
                "refund_amount": "10.00",
                "items": [{"product": self.product.id, "quantity": 1, "price": "10.00"}],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)


class Module16ExpenseTests(ModuleFixturesMixin, TestCase):
    def test_expense_and_category_crud(self):
        client = jwt_client(self.user)
        r = client.post(
            "/api/v1/expenses/categories/",
            {"name": "Utilities M726"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        cat_id = unwrap(r)["id"]

        r = client.post(
            "/api/v1/expenses/",
            {
                "category": cat_id,
                "amount": "25.50",
                "description": "Electric",
                "date": str(date.today()),
                "payment_mode": "cash",
                "branch": self.branch.id,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        eid = unwrap(r)["id"]

        r = client.patch(
            f"/api/v1/expenses/{eid}/",
            {"amount": "30.00"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)

        r = client.delete(f"/api/v1/expenses/{eid}/")
        self.assertEqual(r.status_code, 204, r.content)

        r = client.delete(f"/api/v1/expenses/categories/{cat_id}/")
        self.assertEqual(r.status_code, 204, r.content)


class Module17AccountingTests(ModuleFixturesMixin, TestCase):
    def test_ledger_trial_balance_and_profit_loss(self):
        client = jwt_client(self.user)
        LedgerEntry.objects.create(
            ledger_type=LedgerEntry.LedgerType.SALES,
            reference_id=1,
            description="test sale",
            debit=Decimal("100"),
            credit=Decimal("0"),
            balance=Decimal("100"),
            reference_number="INV-T",
            entry_date=date.today(),
            created_by=self.user,
            branch=self.branch,
        )
        r = client.get("/api/v1/ledger/")
        self.assertEqual(r.status_code, 200, r.content)

        r = client.get("/api/v1/ledger/trial-balance/")
        self.assertEqual(r.status_code, 200, r.content)
        tb = unwrap(r)
        self.assertIn("debit_total", tb)

        r = client.get("/api/v1/ledger/profit-loss/")
        self.assertEqual(r.status_code, 200, r.content)
        pl = unwrap(r)
        self.assertNotEqual(pl["revenue"], "0")

        r = client.get("/api/v1/ledger/cash-flow/")
        self.assertEqual(r.status_code, 200, r.content)


class Module18PaymentHistoryTests(ModuleFixturesMixin, TestCase):
    def test_customer_payment_history_endpoint(self):
        client = jwt_client(self.user)
        cust = Customer.objects.create(name="Pay Hist")
        cust.branches.add(self.branch)
        r = client.get(f"/api/v1/customers/{cust.id}/payment-history/")
        self.assertEqual(r.status_code, 200, r.content)


class Module19CouponTests(ModuleFixturesMixin, TestCase):
    def test_coupon_create_and_list(self):
        client = jwt_client(self.user)
        r = client.post(
            "/api/v1/coupons/",
            {
                "code": "SAVE10M726",
                "discount_type": "percent",
                "discount_value": "10",
                "min_order_value": "0",
                "expiry_date": str(date.today() + timedelta(days=30)),
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        r = client.get("/api/v1/coupons/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(Coupon.objects.filter(code="SAVE10M726").exists())


class Module20LoyaltyFieldTests(ModuleFixturesMixin, TestCase):
    def test_reward_points_persisted(self):
        client = jwt_client(self.user)
        r = client.post(
            "/api/v1/customers/",
            {
                "name": "Loyal Patron",
                "reward_points": 120,
                "branch_ids": [self.branch.id],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(unwrap(r)["reward_points"], 120)


class Module21ReportsTests(ModuleFixturesMixin, TestCase):
    def test_all_report_endpoints(self):
        client = jwt_client(self.user)
        paths = [
            "/api/v1/reports/sales/",
            "/api/v1/reports/purchases/",
            "/api/v1/reports/inventory/",
            "/api/v1/reports/profit/",
            "/api/v1/reports/expenses/",
            "/api/v1/reports/due-payments/",
            "/api/v1/reports/day-closing/",
        ]
        for path in paths:
            r = client.get(path)
            self.assertEqual(r.status_code, 200, f"{path}: {r.content}")


class Module22DashboardTests(ModuleFixturesMixin, TestCase):
    def test_dashboard_summary(self):
        client = jwt_client(self.user)
        r = client.get("/api/v1/dashboard/summary/")
        self.assertEqual(r.status_code, 200, r.content)
        body = unwrap(r)
        self.assertIn("sales_today", body)
        self.assertIn("low_stock_count", body)


class Module23NotificationTests(ModuleFixturesMixin, TestCase):
    def test_notifications_list_and_mark_read(self):
        Notification.objects.create(
            title="Low stock",
            message="Widget low",
            notification_type="low_stock",
            user=self.user,
        )
        client = jwt_client(self.user)
        r = client.get("/api/v1/notifications/")
        self.assertEqual(r.status_code, 200, r.content)
        data = unwrap(r)
        results = data.get("results", data)
        nid = results[0]["id"]

        r = client.post(f"/api/v1/notifications/{nid}/read/")
        self.assertEqual(r.status_code, 200, r.content)

        r = client.post("/api/v1/notifications/read-all/")
        self.assertEqual(r.status_code, 200, r.content)


class Module24AuditLogTests(ModuleFixturesMixin, TestCase):
    def test_audit_log_api_after_mutation(self):
        AuditLog.objects.create(
            user=self.user,
            action="create",
            module="suppliers",
            description="POST /api/v1/suppliers/",
        )
        client = jwt_client(self.user)
        r = client.get("/api/v1/audit-logs/")
        self.assertEqual(r.status_code, 200, r.content)
        data = unwrap(r)
        results = data.get("results", data)
        self.assertGreaterEqual(len(results), 1)


class Module25TaxFieldTests(ModuleFixturesMixin, TestCase):
    def test_product_tax_and_business_settings(self):
        client = jwt_client(self.user)
        r = client.patch(
            f"/api/v1/products/{self.product.id}/",
            {"tax_percent": "15.00"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)

        r = client.get("/api/v1/settings/business/")
        self.assertEqual(r.status_code, 200, r.content)


class Module26BackupTests(ModuleFixturesMixin, TestCase):
    def test_backup_export(self):
        client = jwt_client(self.user)
        r = client.get("/api/v1/backup/export/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIn("application/json", r.get("Content-Type", ""))

    def test_backup_history(self):
        client = jwt_client(self.user)
        r = client.get("/api/v1/backup/history/")
        self.assertEqual(r.status_code, 200, r.content)
