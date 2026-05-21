from decimal import Decimal

from django.db import transaction
from django.db.models import F

from apps.inventory.models import StockMovement
from apps.ledger.models import LedgerEntry
from apps.products.models import Product, ProductVariant
from apps.suppliers.models import Supplier

from .models import PurchaseOrder, PurchaseItem


@transaction.atomic
def apply_purchase_received(po: PurchaseOrder, user, lines: list[dict] | None = None):
    """
    Increase stock for purchase lines. If ``lines`` is provided, each entry is
    ``{product, quantity}`` for partial receive; otherwise receive all remaining qty.
    """
    if po.status == PurchaseOrder.Status.CANCELLED:
        return

    items = list(po.items.select_related("product", "variant"))
    receive_map = {}
    if lines:
        for row in lines:
            receive_map[int(row["product"])] = int(row.get("quantity", 0))

    any_received = False
    for item in items:
        if lines:
            qty = receive_map.get(item.product_id, 0)
            if qty <= 0:
                continue
            remaining = item.quantity - item.received_quantity
            qty = min(qty, remaining)
        else:
            qty = item.quantity - item.received_quantity

        if qty <= 0:
            continue

        any_received = True
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
        PurchaseItem.objects.filter(pk=item.pk).update(
            received_quantity=F("received_quantity") + qty
        )

    if not any_received:
        return

    po.refresh_from_db()
    items = list(po.items.all())
    fully_received = all(i.received_quantity >= i.quantity for i in items)
    if fully_received:
        po.status = PurchaseOrder.Status.RECEIVED
    else:
        po.status = PurchaseOrder.Status.PARTIAL

    if not po.inventory_applied and fully_received:
        _create_supplier_ledger(po, user)
        po.inventory_applied = True

    po.save(update_fields=["status", "inventory_applied"])


def _create_supplier_ledger(po: PurchaseOrder, user) -> None:
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
