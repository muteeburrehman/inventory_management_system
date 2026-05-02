from decimal import Decimal

from django.utils import timezone

from apps.ledger.models import LedgerEntry

from .models import Expense


def create_expense_ledger(expense: Expense, user):
    LedgerEntry.objects.create(
        ledger_type=LedgerEntry.LedgerType.EXPENSE,
        reference_id=expense.id,
        description=expense.description or f"Expense {expense.category.name}",
        debit=expense.amount,
        credit=Decimal("0"),
        balance=expense.amount,
        reference_number=f"EXP-{expense.id}",
        entry_date=expense.date,
        created_by_id=user.id if user and getattr(user, "is_authenticated", False) else None,
        branch_id=expense.branch_id,
    )
