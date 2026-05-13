"""Reporting endpoints — real aggregations across sales, purchases, inventory,
profit, expenses and party balances.

All endpoints accept an optional date range (`date_from`, `date_to`,
YYYY-MM-DD). When the range is missing we default to the last 30 days for
time-series endpoints. Money values are returned as JSON-friendly floats with
two decimals; clients should format with their own locale.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db.models import (
    Count,
    DecimalField,
    ExpressionWrapper,
    F,
    IntegerField,
    Q,
    Sum,
)
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.customers.models import Customer
from apps.expenses.models import Expense
from apps.products.models import Product
from apps.purchases.models import PurchaseItem, PurchaseOrder
from apps.sales.models import Sale, SaleItem
from apps.suppliers.models import Supplier


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

ZERO = Decimal("0")


def _money(value):
    """Round a decimal-ish value to 2 places and return a JSON-safe float."""
    if value is None:
        return 0.0
    try:
        return float(Decimal(value).quantize(Decimal("0.01")))
    except Exception:  # noqa: BLE001
        try:
            return float(value)
        except Exception:  # noqa: BLE001
            return 0.0


def _int(value):
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def _resolve_range(request, *, default_days=30):
    """Return (start_date, end_date) for the report. Both inclusive."""
    today = timezone.localdate()
    end = _parse_date(request.query_params.get("date_to")) or today
    start = _parse_date(request.query_params.get("date_from")) or (
        end - timedelta(days=default_days - 1)
    )
    if start > end:
        start, end = end, start
    return start, end


def _date_range_iter(start, end):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def _fill_series(rows_by_date, start, end, fields):
    """Turn a dict { date: { field: value } } into an ordered list, filling
    missing dates with zeros for every field."""
    out = []
    for d in _date_range_iter(start, end):
        entry = {"date": d.isoformat()}
        existing = rows_by_date.get(d, {})
        for f in fields:
            v = existing.get(f, 0)
            entry[f] = _money(v) if f != "count" else _int(v)
        out.append(entry)
    return out


# ---------------------------------------------------------------------------
# sales
# ---------------------------------------------------------------------------


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sales_report(request):
    start, end = _resolve_range(request)
    qs = Sale.objects.filter(
        status=Sale.Status.COMPLETED,
        sale_date__date__gte=start,
        sale_date__date__lte=end,
    )

    totals = qs.aggregate(
        count=Count("id"),
        revenue=Coalesce(Sum("total_amount"), ZERO, output_field=DecimalField()),
        discount=Coalesce(Sum("discount"), ZERO, output_field=DecimalField()),
        tax=Coalesce(Sum("tax"), ZERO, output_field=DecimalField()),
        paid=Coalesce(Sum("paid_amount"), ZERO, output_field=DecimalField()),
        due=Coalesce(Sum("due_amount"), ZERO, output_field=DecimalField()),
    )
    count = _int(totals["count"])
    revenue = _money(totals["revenue"])

    items_sold = SaleItem.objects.filter(sale__in=qs).aggregate(
        q=Coalesce(Sum("quantity"), 0, output_field=IntegerField())
    )["q"]

    # Daily series.
    daily = (
        qs.annotate(d=TruncDate("sale_date"))
        .values("d")
        .annotate(
            count=Count("id"),
            revenue=Coalesce(Sum("total_amount"), ZERO, output_field=DecimalField()),
        )
        .order_by("d")
    )
    by_date = {row["d"]: row for row in daily}
    series = _fill_series(by_date, start, end, ["count", "revenue"])

    # Payment breakdown.
    payment_rows = (
        qs.values("payment_mode")
        .annotate(
            total=Coalesce(Sum("total_amount"), ZERO, output_field=DecimalField()),
            count=Count("id"),
        )
        .order_by("-total")
    )
    payments = [
        {
            "mode": row["payment_mode"] or "cash",
            "count": _int(row["count"]),
            "total": _money(row["total"]),
        }
        for row in payment_rows
    ]

    # Top products by revenue in the window.
    top = (
        SaleItem.objects.filter(sale__in=qs)
        .values("product_id", "product__name", "product__sku")
        .annotate(
            qty=Coalesce(Sum("quantity"), 0, output_field=IntegerField()),
            revenue=Coalesce(Sum("subtotal"), ZERO, output_field=DecimalField()),
        )
        .order_by("-revenue")[:5]
    )
    top_products = [
        {
            "id": row["product_id"],
            "name": row["product__name"],
            "sku": row["product__sku"],
            "quantity": _int(row["qty"]),
            "revenue": _money(row["revenue"]),
        }
        for row in top
    ]

    return Response(
        {
            "range": {"date_from": start.isoformat(), "date_to": end.isoformat()},
            "totals": {
                "count": count,
                "revenue": revenue,
                "discount": _money(totals["discount"]),
                "tax": _money(totals["tax"]),
                "paid": _money(totals["paid"]),
                "due": _money(totals["due"]),
                "items_sold": _int(items_sold),
                "avg_ticket": _money(revenue / count) if count else 0.0,
            },
            "series": series,
            "payments": payments,
            "top_products": top_products,
        }
    )


# ---------------------------------------------------------------------------
# purchases
# ---------------------------------------------------------------------------


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def purchases_report(request):
    start, end = _resolve_range(request)
    qs = PurchaseOrder.objects.exclude(status=PurchaseOrder.Status.CANCELLED).filter(
        purchase_date__gte=start,
        purchase_date__lte=end,
    )

    totals = qs.aggregate(
        count=Count("id"),
        total=Coalesce(Sum("total_amount"), ZERO, output_field=DecimalField()),
        paid=Coalesce(Sum("paid_amount"), ZERO, output_field=DecimalField()),
        due=Coalesce(Sum("due_amount"), ZERO, output_field=DecimalField()),
    )

    items_bought = PurchaseItem.objects.filter(purchase__in=qs).aggregate(
        q=Coalesce(Sum("quantity"), 0, output_field=IntegerField())
    )["q"]

    daily = (
        qs.values("purchase_date")
        .annotate(
            count=Count("id"),
            total=Coalesce(Sum("total_amount"), ZERO, output_field=DecimalField()),
        )
        .order_by("purchase_date")
    )
    by_date = {row["purchase_date"]: row for row in daily}
    series = _fill_series(by_date, start, end, ["count", "total"])

    top = (
        qs.values("supplier_id", "supplier__name")
        .annotate(
            count=Count("id"),
            total=Coalesce(Sum("total_amount"), ZERO, output_field=DecimalField()),
        )
        .order_by("-total")[:5]
    )
    top_suppliers = [
        {
            "id": row["supplier_id"],
            "name": row["supplier__name"],
            "count": _int(row["count"]),
            "total": _money(row["total"]),
        }
        for row in top
    ]

    return Response(
        {
            "range": {"date_from": start.isoformat(), "date_to": end.isoformat()},
            "totals": {
                "count": _int(totals["count"]),
                "total": _money(totals["total"]),
                "paid": _money(totals["paid"]),
                "due": _money(totals["due"]),
                "items_bought": _int(items_bought),
            },
            "series": series,
            "top_suppliers": top_suppliers,
        }
    )


# ---------------------------------------------------------------------------
# inventory
# ---------------------------------------------------------------------------


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_report(request):
    value_expr = ExpressionWrapper(
        F("current_stock") * F("purchase_price"),
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )
    retail_expr = ExpressionWrapper(
        F("current_stock") * F("selling_price"),
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )
    agg = Product.objects.aggregate(
        total_products=Count("id"),
        total_units=Coalesce(Sum("current_stock"), 0, output_field=IntegerField()),
        stock_value=Coalesce(Sum(value_expr), ZERO, output_field=DecimalField()),
        retail_value=Coalesce(Sum(retail_expr), ZERO, output_field=DecimalField()),
        low_stock_count=Count(
            "id", filter=Q(current_stock__lte=F("min_stock_level"), current_stock__gt=0)
        ),
        out_of_stock_count=Count("id", filter=Q(current_stock__lte=0)),
    )

    low_stock = (
        Product.objects.filter(current_stock__lte=F("min_stock_level"))
        .select_related("category", "brand")
        .order_by("current_stock", "name")[:25]
        .values(
            "id", "name", "sku", "current_stock", "min_stock_level",
            "category__name", "brand__name",
        )
    )
    low_stock_items = [
        {
            "id": r["id"],
            "name": r["name"],
            "sku": r["sku"],
            "current_stock": _int(r["current_stock"]),
            "min_stock_level": _int(r["min_stock_level"]),
            "category": r["category__name"] or "—",
            "brand": r["brand__name"] or "—",
        }
        for r in low_stock
    ]

    return Response(
        {
            "totals": {
                "total_products": _int(agg["total_products"]),
                "total_units": _int(agg["total_units"]),
                "stock_value": _money(agg["stock_value"]),
                "retail_value": _money(agg["retail_value"]),
                "potential_profit": _money(
                    Decimal(str(agg["retail_value"])) - Decimal(str(agg["stock_value"]))
                ),
                "low_stock_count": _int(agg["low_stock_count"]),
                "out_of_stock_count": _int(agg["out_of_stock_count"]),
            },
            "low_stock_items": low_stock_items,
        }
    )


# ---------------------------------------------------------------------------
# profit (revenue - COGS)
# ---------------------------------------------------------------------------


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profit_report(request):
    start, end = _resolve_range(request)
    sales_qs = Sale.objects.filter(
        status=Sale.Status.COMPLETED,
        sale_date__date__gte=start,
        sale_date__date__lte=end,
    )
    items_qs = SaleItem.objects.filter(sale__in=sales_qs).select_related("sale", "product")

    cogs_expr = ExpressionWrapper(
        F("quantity") * F("product__purchase_price"),
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )

    totals = items_qs.aggregate(
        revenue=Coalesce(Sum("subtotal"), ZERO, output_field=DecimalField()),
        cogs=Coalesce(Sum(cogs_expr), ZERO, output_field=DecimalField()),
    )
    revenue = Decimal(str(totals["revenue"]))
    cogs = Decimal(str(totals["cogs"]))
    profit = revenue - cogs
    margin = float((profit / revenue * 100).quantize(Decimal("0.01"))) if revenue else 0.0

    # Daily breakdown.
    daily = (
        items_qs.annotate(d=TruncDate("sale__sale_date"))
        .values("d")
        .annotate(
            revenue=Coalesce(Sum("subtotal"), ZERO, output_field=DecimalField()),
            cogs=Coalesce(Sum(cogs_expr), ZERO, output_field=DecimalField()),
        )
        .order_by("d")
    )
    by_date = {}
    for row in daily:
        r = Decimal(str(row["revenue"]))
        c = Decimal(str(row["cogs"]))
        by_date[row["d"]] = {"revenue": r, "cogs": c, "profit": r - c}
    series = _fill_series(by_date, start, end, ["revenue", "cogs", "profit"])

    return Response(
        {
            "range": {"date_from": start.isoformat(), "date_to": end.isoformat()},
            "totals": {
                "revenue": _money(revenue),
                "cogs": _money(cogs),
                "gross_profit": _money(profit),
                "margin_percent": margin,
            },
            "series": series,
        }
    )


# ---------------------------------------------------------------------------
# expenses
# ---------------------------------------------------------------------------


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def expenses_report(request):
    start, end = _resolve_range(request)
    qs = Expense.objects.filter(date__gte=start, date__lte=end)

    totals = qs.aggregate(
        count=Count("id"),
        total=Coalesce(Sum("amount"), ZERO, output_field=DecimalField()),
    )

    by_category = (
        qs.values("category_id", "category__name")
        .annotate(
            count=Count("id"),
            total=Coalesce(Sum("amount"), ZERO, output_field=DecimalField()),
        )
        .order_by("-total")
    )
    categories = [
        {
            "id": row["category_id"],
            "name": row["category__name"] or "Uncategorised",
            "count": _int(row["count"]),
            "total": _money(row["total"]),
        }
        for row in by_category
    ]

    daily = (
        qs.values("date")
        .annotate(
            total=Coalesce(Sum("amount"), ZERO, output_field=DecimalField()),
        )
        .order_by("date")
    )
    by_date = {row["date"]: {"total": row["total"]} for row in daily}
    series = _fill_series(by_date, start, end, ["total"])

    return Response(
        {
            "range": {"date_from": start.isoformat(), "date_to": end.isoformat()},
            "totals": {
                "count": _int(totals["count"]),
                "total": _money(totals["total"]),
            },
            "categories": categories,
            "series": series,
        }
    )


# ---------------------------------------------------------------------------
# due payments
# ---------------------------------------------------------------------------


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def due_payments_report(request):
    customers = (
        Customer.objects.filter(current_balance__gt=0)
        .order_by("-current_balance")[:25]
        .values("id", "name", "phone", "current_balance", "credit_limit")
    )
    suppliers = (
        Supplier.objects.filter(current_balance__gt=0)
        .order_by("-current_balance")[:25]
        .values("id", "name", "company_name", "phone", "current_balance")
    )
    customer_total = (
        Customer.objects.filter(current_balance__gt=0)
        .aggregate(t=Coalesce(Sum("current_balance"), ZERO, output_field=DecimalField()))
        ["t"]
    )
    supplier_total = (
        Supplier.objects.filter(current_balance__gt=0)
        .aggregate(t=Coalesce(Sum("current_balance"), ZERO, output_field=DecimalField()))
        ["t"]
    )

    return Response(
        {
            "totals": {
                "customer_due": _money(customer_total),
                "supplier_due": _money(supplier_total),
            },
            "customers": [
                {
                    "id": c["id"],
                    "name": c["name"],
                    "phone": c["phone"],
                    "balance": _money(c["current_balance"]),
                    "credit_limit": _money(c["credit_limit"]),
                }
                for c in customers
            ],
            "suppliers": [
                {
                    "id": s["id"],
                    "name": s["name"],
                    "company": s["company_name"],
                    "phone": s["phone"],
                    "balance": _money(s["current_balance"]),
                }
                for s in suppliers
            ],
        }
    )


# ---------------------------------------------------------------------------
# day closing
# ---------------------------------------------------------------------------


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def day_closing_report(request):
    requested = _parse_date(request.query_params.get("date_to"))
    target = requested or timezone.localdate()

    sales_qs = Sale.objects.filter(
        status=Sale.Status.COMPLETED, sale_date__date=target
    )
    sales_totals = sales_qs.aggregate(
        count=Count("id"),
        revenue=Coalesce(Sum("total_amount"), ZERO, output_field=DecimalField()),
        cash=Coalesce(
            Sum("paid_amount", filter=Q(payment_mode__iexact="cash")),
            ZERO,
            output_field=DecimalField(),
        ),
        due=Coalesce(Sum("due_amount"), ZERO, output_field=DecimalField()),
    )

    purchases_qs = PurchaseOrder.objects.exclude(
        status=PurchaseOrder.Status.CANCELLED
    ).filter(purchase_date=target)
    purchase_totals = purchases_qs.aggregate(
        count=Count("id"),
        total=Coalesce(Sum("total_amount"), ZERO, output_field=DecimalField()),
        paid=Coalesce(Sum("paid_amount"), ZERO, output_field=DecimalField()),
    )

    expenses_total = Expense.objects.filter(date=target).aggregate(
        t=Coalesce(Sum("amount"), ZERO, output_field=DecimalField()),
        c=Count("id"),
    )

    payment_rows = (
        sales_qs.values("payment_mode")
        .annotate(
            count=Count("id"),
            total=Coalesce(Sum("paid_amount"), ZERO, output_field=DecimalField()),
        )
        .order_by("-total")
    )
    payments = [
        {
            "mode": row["payment_mode"] or "cash",
            "count": _int(row["count"]),
            "total": _money(row["total"]),
        }
        for row in payment_rows
    ]

    cash_in = Decimal(str(sales_totals["cash"]))
    cash_out = Decimal(str(expenses_total["t"]))
    net_cash = cash_in - cash_out

    return Response(
        {
            "date": target.isoformat(),
            "totals": {
                "sales_count": _int(sales_totals["count"]),
                "sales_revenue": _money(sales_totals["revenue"]),
                "sales_due": _money(sales_totals["due"]),
                "purchases_count": _int(purchase_totals["count"]),
                "purchases_total": _money(purchase_totals["total"]),
                "purchases_paid": _money(purchase_totals["paid"]),
                "expenses_count": _int(expenses_total["c"]),
                "expenses_total": _money(expenses_total["t"]),
                "cash_in": _money(cash_in),
                "cash_out": _money(cash_out),
                "net_cash": _money(net_cash),
            },
            "payments": payments,
        }
    )
