from decimal import Decimal

from django.db import transaction
from django.db.models import F

from apps.inventory.models import StockMovement
from apps.ledger.models import LedgerEntry
from apps.products.models import Product, ProductVariant
from apps.suppliers.models import Supplier

from .models import PurchaseOrder


@transaction.atomic
def apply_purchase_received(po: PurchaseOrder, user):
    """Increase stock and supplier ledger when purchase is marked received."""
    if po.inventory_applied or po.status != PurchaseOrder.Status.RECEIVED:
        return
    for item in po.items.select_related("product", "variant"):
        qty = item.quantity
        if item.variant_id:
            ProductVariant.objects.filter(pk=item.variant_id).update(stock=F("stock") + qty)
        else:
            Product.objects.filter(pk=item.product_id).update(current_stock=F("current_stock") + qty)
        StockMovement.objects.create(
            product_id=item.product_id,
            variant_id=item.variant_id,
            movement_type=StockMovement.MovementType.IN,
            quantity=qty,
            reason="purchase",
            reference=po.invoice_number,
            branch_id=po.branch_id,
            created_by_id=user.id if user and getattr(user, "is_authenticated", False) else None,
        )
    po.inventory_applied = True
    po.save(update_fields=["inventory_applied"])

    Supplier.objects.filter(pk=po.supplier_id).update(
        current_balance=F("current_balance") + po.due_amount
    )

    last = (
        LedgerEntry.objects.filter(ledger_type=LedgerEntry.LedgerType.PURCHASE, reference_id=po.id)
        .order_by("-id")
        .first()
    )
    bal = (last.balance if last else Decimal("0")) - po.paid_amount + po.total_amount
    LedgerEntry.objects.create(
        ledger_type=LedgerEntry.LedgerType.PURCHASE,
        reference_id=po.id,
        description=f"Purchase {po.invoice_number}",
        debit=po.total_amount,
        credit=po.paid_amount,
        balance=bal,
        reference_number=po.invoice_number,
        entry_date=po.purchase_date,
        created_by_id=user.id if user and getattr(user, "is_authenticated", False) else None,
        branch_id=po.branch_id,
    )
