from datetime import timedelta
from decimal import Decimal

from django.db.models import Exists, F, IntegerField, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.customers.models import Customer
from apps.expenses.models import Expense
from apps.inventory.models import StockMovement
from apps.products.models import Category, Product
from apps.purchases.models import PurchaseOrder
from apps.sales.models import Sale
from apps.sales.serializers import SaleListSerializer
from apps.suppliers.models import Supplier

from .scope import dashboard_widgets_for_role, filter_by_branches, resolve_dashboard_branches


def _branch_stock_counts(branch_ids: list[int]) -> tuple[int, int]:
    """Low / out-of-stock at branch(es), only among products with stock movement there."""
    if not branch_ids:
        return 0, 0

    mov_filter = dict(
        product_id=OuterRef("pk"),
        branch_id__in=branch_ids,
        variant__isnull=True,
    )
    stock_sub = (
        StockMovement.objects.filter(**mov_filter)
        .values("product_id")
        .annotate(t=Sum("quantity"))
        .values("t")[:1]
    )
    has_movement = Exists(StockMovement.objects.filter(**mov_filter))

    qs = Product.objects.annotate(
        bqty=Coalesce(Subquery(stock_sub, output_field=IntegerField()), Value(0)),
    ).filter(has_movement)

    low = qs.filter(bqty__gt=0, bqty__lte=F("min_stock_level")).count()
    out = qs.filter(bqty__lte=0).count()
    return low, out


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    user = request.user
    branch_ids, scope = resolve_dashboard_branches(user)
    role = getattr(user, "role", "") or ""

    scope_payload = {**scope, "branch_ids": branch_ids}

    if scope["mode"] == "denied":
        return Response(
            {
                "scope": scope_payload,
                "role_widgets": dashboard_widgets_for_role(role),
                "error": "branch_access",
                "message": "Your profile is not allowed to use the selected branch.",
            },
            status=400,
        )

    if not branch_ids:
        return Response(
            {
                "scope": scope_payload,
                "role_widgets": dashboard_widgets_for_role(role),
                "total_products": Product.objects.count(),
                "total_categories": Category.objects.count(),
                "total_customers": 0,
                "total_suppliers": 0,
                "sales_today": "0",
                "monthly_revenue": "0",
                "total_sales_all_time": "0",
                "pending_payments": "0",
                "outstanding_receivables": "0",
                "outstanding_payables": "0",
                "month_expenses": "0",
                "low_stock_count": 0,
                "out_of_stock_count": 0,
                "profit_summary": {
                    "month_revenue": "0",
                    "month_expenses": "0",
                    "note": "Select a branch in the header to load branch snapshots.",
                },
                "revenue_chart": [],
                "recent_sales": [],
                "recent_purchases": [],
            }
        )

    today = timezone.localdate()
    month_start = today.replace(day=1)

    sales_qs = filter_by_branches(Sale.objects.all(), branch_ids)
    purchases_qs = filter_by_branches(PurchaseOrder.objects.all(), branch_ids)
    expense_qs = filter_by_branches(Expense.objects.all(), branch_ids)

    sales_today = (
        sales_qs.filter(status=Sale.Status.COMPLETED, sale_date__date=today).aggregate(
            t=Sum("total_amount")
        )["t"]
        or Decimal("0")
    )
    monthly_revenue = (
        sales_qs.filter(status=Sale.Status.COMPLETED, sale_date__date__gte=month_start).aggregate(
            t=Sum("total_amount")
        )["t"]
        or Decimal("0")
    )
    total_sales_all = (
        sales_qs.filter(status=Sale.Status.COMPLETED).aggregate(t=Sum("total_amount"))["t"]
        or Decimal("0")
    )

    pending_customer_due = (
        sales_qs.filter(status=Sale.Status.COMPLETED, due_amount__gt=0).aggregate(
            t=Sum("due_amount")
        )["t"]
        or Decimal("0")
    )

    customer_ids_at_branch = list(
        sales_qs.filter(customer_id__isnull=False).values_list("customer_id", flat=True).distinct()
    )
    supplier_ids_at_branch = list(
        purchases_qs.values_list("supplier_id", flat=True).distinct()
    )

    outstanding_receivables = Decimal("0")
    if customer_ids_at_branch:
        outstanding_receivables = (
            Customer.objects.filter(pk__in=customer_ids_at_branch, current_balance__gt=0).aggregate(
                t=Sum("current_balance")
            )["t"]
            or Decimal("0")
        )
    outstanding_payables = Decimal("0")
    if supplier_ids_at_branch:
        outstanding_payables = (
            Supplier.objects.filter(pk__in=supplier_ids_at_branch, current_balance__gt=0).aggregate(
                t=Sum("current_balance")
            )["t"]
            or Decimal("0")
        )

    month_expenses = (
        expense_qs.filter(date__gte=month_start).aggregate(t=Sum("amount"))["t"] or Decimal("0")
    )

    low_stock, out_of_stock = _branch_stock_counts(branch_ids)

    last_30 = timezone.localdate() - timedelta(days=30)
    chart = (
        sales_qs.filter(status=Sale.Status.COMPLETED, sale_date__date__gte=last_30)
        .annotate(d=TruncDate("sale_date"))
        .values("d")
        .annotate(total=Sum("total_amount"))
        .order_by("d")
    )

    recent_sales = (
        sales_qs.filter(status=Sale.Status.COMPLETED)
        .select_related("customer", "cashier", "branch", "coupon")
        .order_by("-sale_date")[:10]
    )
    recent_purchases = purchases_qs.select_related("supplier", "branch").order_by(
        "-purchase_date", "-id"
    )[:8]

    return Response(
        {
            "scope": scope_payload,
            "role_widgets": dashboard_widgets_for_role(role),
            "total_products": Product.objects.count(),
            "total_categories": Category.objects.count(),
            "total_customers": Customer.objects.filter(branches__id__in=branch_ids)
            .distinct()
            .count(),
            "total_suppliers": Supplier.objects.filter(branches__id__in=branch_ids)
            .distinct()
            .count(),
            "sales_today": str(sales_today),
            "monthly_revenue": str(monthly_revenue),
            "total_sales_all_time": str(total_sales_all),
            "pending_payments": str(pending_customer_due),
            "outstanding_receivables": str(outstanding_receivables),
            "outstanding_payables": str(outstanding_payables),
            "month_expenses": str(month_expenses),
            "low_stock_count": low_stock,
            "out_of_stock_count": out_of_stock,
            "profit_summary": {
                "month_revenue": str(monthly_revenue),
                "month_expenses": str(month_expenses),
                "note": "Margin uses branch sales vs branch expenses this month; COGS refinement pending.",
            },
            "revenue_chart": list(chart),
            "recent_sales": SaleListSerializer(recent_sales, many=True).data,
            "recent_purchases": [
                {
                    "id": po.id,
                    "invoice_number": po.invoice_number,
                    "supplier_name": po.supplier.name if po.supplier_id else "",
                    "total_amount": str(po.total_amount),
                    "purchase_date": str(po.purchase_date),
                    "status": po.status,
                }
                for po in recent_purchases
            ],
        }
    )
