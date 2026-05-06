from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Supplier
from .serializers import SupplierSerializer, filter_suppliers_queryset_for_user


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("name", "company_name", "phone", "email")
    ordering_fields = ("name", "id")
    envelope_message = "Suppliers."

    def get_queryset(self):
        return filter_suppliers_queryset_for_user(Supplier.objects.all(), self.request.user)

    @action(detail=True, methods=["get"], url_path="ledger")
    def ledger(self, request, pk=None):
        return Response([])

    @action(detail=True, methods=["get"], url_path="purchase-history")
    def purchase_history(self, request, pk=None):
        from apps.purchases.models import PurchaseOrder
        from apps.purchases.serializers import PurchaseListSerializer

        qs = (
            PurchaseOrder.objects.filter(supplier_id=pk)
            .select_related("supplier", "branch")
            .order_by("-purchase_date")[:50]
        )
        return Response(PurchaseListSerializer(qs, many=True).data)
