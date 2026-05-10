from decimal import Decimal

from django.db.models import Sum
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.dashboard.scope import resolve_dashboard_branches
from apps.sales.models import Sale
from apps.sales.serializers import SaleListSerializer

from .models import Customer
from .serializers import CustomerSerializer, filter_customers_queryset_for_user


def _customer_sale_queryset(request, customer_pk):
    """Sales for this customer limited to branches the user may see."""
    branch_ids, meta = resolve_dashboard_branches(request.user)
    qs = Sale.objects.filter(customer_id=customer_pk).select_related(
        "customer", "cashier", "branch", "coupon"
    )
    if meta.get("mode") == "denied":
        return qs.none()
    if not branch_ids:
        return qs.none()
    return qs.filter(branch_id__in=branch_ids)


def _payment_history_rows(qs):
    """Flatten split payments (or sale-level paid_amount) into chronological rows."""
    rows = []
    for sale in qs:
        splits = list(sale.split_payments.all())
        if splits:
            for sp in splits:
                rows.append(
                    {
                        "invoice_number": sale.invoice_number,
                        "sale_date": sale.sale_date.isoformat(),
                        "payment_mode": sp.payment_mode,
                        "amount": str(sp.amount),
                        "branch_name": sale.branch.name if sale.branch_id else "",
                    }
                )
        elif sale.paid_amount and sale.paid_amount > Decimal("0"):
            rows.append(
                {
                    "invoice_number": sale.invoice_number,
                    "sale_date": sale.sale_date.isoformat(),
                    "payment_mode": sale.payment_mode,
                    "amount": str(sale.paid_amount),
                    "branch_name": sale.branch.name if sale.branch_id else "",
                }
            )
    rows.sort(key=lambda r: r["sale_date"], reverse=True)
    return rows[:100]


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("name", "phone", "email")
    ordering_fields = ("name", "id")
    envelope_message = "Customers."

    def get_queryset(self):
        return filter_customers_queryset_for_user(Customer.objects.all(), self.request.user)

    @action(detail=True, methods=["get"], url_path="ledger")
    def ledger(self, request, pk=None):
        customer = self.get_object()
        qs = _customer_sale_queryset(request, pk).exclude(status=Sale.Status.CANCELLED)
        agg = qs.aggregate(
            total_sales=Sum("total_amount"),
            paid_amount=Sum("paid_amount"),
            due_amount=Sum("due_amount"),
        )

        def _d(v):
            return v if v is not None else Decimal("0")

        return Response(
            {
                "sale_count": qs.count(),
                "total_sales": str(_d(agg["total_sales"])),
                "paid_amount": str(_d(agg["paid_amount"])),
                "due_amount": str(_d(agg["due_amount"])),
                "current_balance": str(customer.current_balance),
            }
        )

    @action(detail=True, methods=["get"], url_path="purchase-history")
    def purchase_history(self, request, pk=None):
        self.get_object()
        qs = (
            _customer_sale_queryset(request, pk)
            .exclude(status=Sale.Status.CANCELLED)
            .order_by("-sale_date")[:50]
        )
        return Response(SaleListSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"], url_path="payment-history")
    def payment_history(self, request, pk=None):
        self.get_object()
        qs = (
            _customer_sale_queryset(request, pk)
            .exclude(status=Sale.Status.CANCELLED)
            .select_related("branch")
            .prefetch_related("split_payments")
            .order_by("-sale_date")[:100]
        )
        return Response(_payment_history_rows(qs))
