"""Integration tests for branch profile linking, ledger FK, and branch uniqueness."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.expenses.models import Expense, ExpenseCategory
from apps.accounts.models import UserBranchAccess
from apps.expenses.services import create_expense_ledger
from apps.ledger.models import LedgerEntry
from apps.settings_app.models import Branch

User = get_user_model()


def _jwt_client(user: User) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")
    return client


class MeBranchLinkingTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Test Branch Alpha")
        self.user = User.objects.create_user(
            username="linkuser",
            email="link@test.com",
            password="testpass123",
        )
        UserBranchAccess.objects.create(user=self.user, branch=self.branch)

    def test_patch_me_sets_branch(self):
        client = _jwt_client(self.user)
        r = client.patch(
            "/api/v1/auth/me/",
            {"branch": self.branch.id},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertTrue(body.get("success"), body)
        self.assertEqual(body["data"]["branch"]["id"], self.branch.id)

        self.user.refresh_from_db()
        self.assertEqual(self.user.branch_id, self.branch.id)

    def test_patch_me_clears_branch(self):
        self.user.branch = self.branch
        self.user.save(update_fields=["branch_id"])
        client = _jwt_client(self.user)
        r = client.patch("/api/v1/auth/me/", {"branch": None}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.branch_id)


class ExpenseLedgerBranchTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Exp Branch")
        self.user = User.objects.create_user(
            username="expuser",
            email="exp@test.com",
            password="testpass123",
        )
        self.category = ExpenseCategory.objects.create(name="General")

    def test_expense_ledger_has_branch(self):
        expense = Expense.objects.create(
            category=self.category,
            amount=Decimal("10.00"),
            date="2026-05-01",
            branch=self.branch,
            created_by=self.user,
        )
        create_expense_ledger(expense, self.user)
        le = LedgerEntry.objects.get(
            ledger_type=LedgerEntry.LedgerType.EXPENSE,
            reference_id=expense.id,
        )
        self.assertEqual(le.branch_id, self.branch.id)


class LedgerApiBranchTests(TestCase):
    def setUp(self):
        self.b1 = Branch.objects.create(name="Ledger Branch One")
        self.b2 = Branch.objects.create(name="Ledger Branch Two")
        self.user = User.objects.create_user(
            username="leduser",
            email="led@test.com",
            password="testpass123",
        )
        LedgerEntry.objects.create(
            ledger_type=LedgerEntry.LedgerType.EXPENSE,
            reference_id=1,
            description="e1",
            debit=Decimal("1"),
            credit=Decimal("0"),
            balance=Decimal("1"),
            reference_number="EXP-1",
            entry_date="2026-05-01",
            created_by=self.user,
            branch=self.b1,
        )
        LedgerEntry.objects.create(
            ledger_type=LedgerEntry.LedgerType.EXPENSE,
            reference_id=2,
            description="e2",
            debit=Decimal("2"),
            credit=Decimal("0"),
            balance=Decimal("2"),
            reference_number="EXP-2",
            entry_date="2026-05-02",
            created_by=self.user,
            branch=self.b2,
        )

    def test_ledger_list_filtered_by_branch(self):
        client = _jwt_client(self.user)
        r = client.get("/api/v1/ledger/", {"branch": self.b1.id})
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertTrue(body.get("success"))
        results = body["data"]["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["branch"]["id"], self.b1.id)


class BranchUniquenessApiTests(TestCase):
    def setUp(self):
        Branch.objects.create(name="Existing Branch Name")
        self.user = User.objects.create_user(
            username="branchapi",
            email="br@test.com",
            password="testpass123",
        )
        self.user.role = User.Role.MANAGER
        self.user.save(update_fields=["role"])

    def test_reject_duplicate_branch_name(self):
        client = _jwt_client(self.user)
        r = client.post(
            "/api/v1/settings/branches/",
            {
                "name": "Existing Branch Name",
                "address": "",
                "phone": "",
                "is_main": False,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)
