from decimal import Decimal

from django.db.models import Sum
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.dashboard.scope import resolve_dashboard_branches
from apps.purchases.models import PurchaseOrder
from apps.purchases.serializers import PurchaseListSerializer

from .models import Supplier
from .serializers import SupplierSerializer, filter_suppliers_queryset_for_user


def _supplier_purchase_queryset(request, supplier_pk):
    """Purchase orders for this supplier limited to branches the user may see."""
    branch_ids, meta = resolve_dashboard_branches(request.user)
    qs = PurchaseOrder.objects.filter(supplier_id=supplier_pk).select_related("supplier", "branch")
    if meta.get("mode") == "denied":
        return qs.none()
    if not branch_ids:
        return qs.none()
    return qs.filter(branch_id__in=branch_ids)


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("name", "company_name", "contact_person", "phone", "email")
    ordering_fields = ("name", "id")
    envelope_message = "Suppliers."

    def get_queryset(self):
        return filter_suppliers_queryset_for_user(Supplier.objects.all(), self.request.user)

    @action(detail=True, methods=["get"], url_path="ledger")
    def ledger(self, request, pk=None):
        self.get_object()
        qs = (
            _supplier_purchase_queryset(request, pk)
            .exclude(status=PurchaseOrder.Status.CANCELLED)
        )
        agg = qs.aggregate(
            total_purchases=Sum("total_amount"),
            paid_amount=Sum("paid_amount"),
            due_amount=Sum("due_amount"),
        )
        def _d(v):
            return v if v is not None else Decimal("0")

        return Response(
            {
                "purchase_count": qs.count(),
                "total_purchases": str(_d(agg["total_purchases"])),
                "paid_amount": str(_d(agg["paid_amount"])),
                "due_amount": str(_d(agg["due_amount"])),
            }
        )

    @action(detail=True, methods=["get"], url_path="purchase-history")
    def purchase_history(self, request, pk=None):
        self.get_object()
        qs = (
            _supplier_purchase_queryset(request, pk)
            .exclude(status=PurchaseOrder.Status.CANCELLED)
            .order_by("-purchase_date")[:50]
        )
        return Response(PurchaseListSerializer(qs, many=True).data)
