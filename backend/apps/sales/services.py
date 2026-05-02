from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import StockMovement
from apps.ledger.models import LedgerEntry
from apps.products.models import Product, ProductVariant

from .models import Sale


def validate_sale_stock(items_data):
    """Raise ValidationError if any line would make stock negative."""
    from rest_framework import serializers as drf_serializers

    for row in items_data:
        pid = row.get("product") or row.get("product_id")
        vid = row.get("variant") or row.get("variant_id")
        if hasattr(pid, "pk"):
            pid = pid.pk
        if vid is not None and hasattr(vid, "pk"):
            vid = vid.pk
        qty = int(row.get("quantity", 0))
        if vid:
            v = ProductVariant.objects.filter(pk=vid).first()
            if not v:
                raise drf_serializers.ValidationError({"variant": "Invalid variant."})
            if v.stock < qty:
                raise drf_serializers.ValidationError(
                    {"quantity": f"Insufficient stock for variant SKU {v.sku}."}
                )
        else:
            p = Product.objects.filter(pk=pid).first()
            if not p:
                raise drf_serializers.ValidationError({"product": "Invalid product."})
            if p.current_stock < qty:
                raise drf_serializers.ValidationError(
                    {"quantity": f"Insufficient stock for product {p.name} (SKU {p.sku})."}
                )


@transaction.atomic
def apply_completed_sale(sale: Sale, user):
    if sale.inventory_applied or sale.status != Sale.Status.COMPLETED:
        return
    for item in sale.items.select_related("product", "variant"):
        qty = item.quantity
        if item.variant_id:
            ProductVariant.objects.filter(pk=item.variant_id).update(stock=F("stock") - qty)
        else:
            Product.objects.filter(pk=item.product_id).update(current_stock=F("current_stock") - qty)
        StockMovement.objects.create(
            product_id=item.product_id,
            variant_id=item.variant_id,
            movement_type=StockMovement.MovementType.OUT,
            quantity=-abs(qty),
            reason="sale",
            reference=sale.invoice_number,
            branch_id=sale.branch_id,
            created_by_id=user.id if user and getattr(user, "is_authenticated", False) else None,
        )
    sale.inventory_applied = True
    sale.save(update_fields=["inventory_applied"])

    if sale.customer_id:
        Customer.objects.filter(pk=sale.customer_id).update(
            current_balance=F("current_balance") + sale.due_amount
        )

    last = (
        LedgerEntry.objects.filter(ledger_type=LedgerEntry.LedgerType.SALES, reference_id=sale.id)
        .order_by("-id")
        .first()
    )
    bal = (last.balance if last else Decimal("0")) + sale.total_amount - sale.paid_amount
    LedgerEntry.objects.create(
        ledger_type=LedgerEntry.LedgerType.SALES,
        reference_id=sale.id,
        description=f"Sale {sale.invoice_number}",
        debit=sale.due_amount,
        credit=sale.paid_amount,
        balance=bal,
        reference_number=sale.invoice_number,
        entry_date=timezone.localdate(),
        created_by_id=user.id if user and getattr(user, "is_authenticated", False) else None,
        branch_id=sale.branch_id,
    )


@transaction.atomic
def apply_sales_return(sret, user):
    sale = sret.sale
    for item in sret.items.select_related("product"):
        qty = item.quantity
        Product.objects.filter(pk=item.product_id).update(current_stock=F("current_stock") + qty)
        StockMovement.objects.create(
            product_id=item.product_id,
            variant=None,
            movement_type=StockMovement.MovementType.IN,
            quantity=qty,
            reason="sales_return",
            reference=sale.invoice_number,
            branch_id=sale.branch_id,
            created_by_id=user.id if user and getattr(user, "is_authenticated", False) else None,
        )
    LedgerEntry.objects.create(
        ledger_type=LedgerEntry.LedgerType.SALES,
        reference_id=sale.id,
        description=f"Sales return for {sale.invoice_number}",
        debit=Decimal("0"),
        credit=sret.refund_amount,
        balance=Decimal("0"),
        reference_number=sale.invoice_number,
        entry_date=sret.return_date,
        created_by_id=user.id if user and getattr(user, "is_authenticated", False) else None,
        branch_id=sale.branch_id,
    )
    sale.status = Sale.Status.RETURNED
    sale.save(update_fields=["status"])
