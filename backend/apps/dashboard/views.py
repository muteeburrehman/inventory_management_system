from datetime import timedelta
from decimal import Decimal

from django.db.models import F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.customers.models import Customer
from apps.products.models import Category, Product
from apps.purchases.models import PurchaseOrder
from apps.sales.models import Sale
from apps.sales.serializers import SaleListSerializer
from apps.suppliers.models import Supplier


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    today = timezone.localdate()
    month_start = today.replace(day=1)

    sales_today = (
        Sale.objects.filter(status=Sale.Status.COMPLETED, sale_date__date=today).aggregate(
            t=Sum("total_amount")
        )["t"]
        or Decimal("0")
    )
    monthly_revenue = (
        Sale.objects.filter(status=Sale.Status.COMPLETED, sale_date__date__gte=month_start).aggregate(
            t=Sum("total_amount")
        )["t"]
        or Decimal("0")
    )
    total_sales_all = (
        Sale.objects.filter(status=Sale.Status.COMPLETED).aggregate(t=Sum("total_amount"))["t"]
        or Decimal("0")
    )

    pending_customer_due = Sale.objects.filter(status=Sale.Status.COMPLETED, due_amount__gt=0).aggregate(
        t=Sum("due_amount")
    )["t"] or Decimal("0")

    outstanding_receivables = (
        Customer.objects.filter(current_balance__gt=0).aggregate(t=Sum("current_balance"))["t"]
        or Decimal("0")
    )
    outstanding_payables = (
        Supplier.objects.filter(current_balance__gt=0).aggregate(t=Sum("current_balance"))["t"]
        or Decimal("0")
    )

    low_stock = Product.objects.filter(
        current_stock__lte=F("min_stock_level"), current_stock__gt=0
    ).count()
    out_of_stock = Product.objects.filter(current_stock=0).count()

    last_30 = timezone.localdate() - timedelta(days=30)
    chart = (
        Sale.objects.filter(status=Sale.Status.COMPLETED, sale_date__date__gte=last_30)
        .annotate(d=TruncDate("sale_date"))
        .values("d")
        .annotate(total=Sum("total_amount"))
        .order_by("d")
    )

    recent_sales = (
        Sale.objects.filter(status=Sale.Status.COMPLETED)
        .select_related("customer", "cashier", "branch", "coupon")
        .order_by("-sale_date")[:10]
    )
    recent_purchases = PurchaseOrder.objects.select_related("supplier", "branch").order_by(
        "-purchase_date", "-id"
    )[:8]

    expenses_month = Decimal("0")  # wire to Expense model when reporting aggregates land

    return Response(
        {
            "total_products": Product.objects.count(),
            "total_categories": Category.objects.count(),
            "total_customers": Customer.objects.count(),
            "total_suppliers": Supplier.objects.count(),
            "sales_today": str(sales_today),
            "monthly_revenue": str(monthly_revenue),
            "total_sales_all_time": str(total_sales_all),
            "pending_payments": str(pending_customer_due),
            "outstanding_receivables": str(outstanding_receivables),
            "outstanding_payables": str(outstanding_payables),
            "low_stock_count": low_stock,
            "out_of_stock_count": out_of_stock,
            "profit_summary": {
                "month_revenue": str(monthly_revenue),
                "month_expenses": str(expenses_month),
                "note": "Net profit uses COGS from purchases in a future iteration.",
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
