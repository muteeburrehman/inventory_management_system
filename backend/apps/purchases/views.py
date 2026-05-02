from decimal import Decimal

from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.products.models import Product

from .models import PurchaseOrder, PurchaseReturn, PurchaseReturnItem
from .serializers import (
    PurchaseDetailSerializer,
    PurchaseListSerializer,
    PurchaseWriteSerializer,
)


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.select_related("supplier", "branch").prefetch_related(
        "items__product",
        "items__variant",
    )
    permission_classes = [IsAuthenticated]
    filterset_fields = ("supplier", "branch", "status")
    search_fields = ("invoice_number",)
    ordering_fields = ("purchase_date", "id")
    envelope_message = "Purchases."

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PurchaseWriteSerializer
        if self.action == "retrieve":
            return PurchaseDetailSerializer
        return PurchaseListSerializer

    @action(detail=True, methods=["post"], url_path="return")
    def purchase_return(self, request, pk=None):
        po = self.get_object()
        payload = request.data
        pr = PurchaseReturn.objects.create(
            purchase=po,
            return_date=payload.get("return_date") or po.purchase_date,
            reason=payload.get("reason", ""),
            total_amount=Decimal(str(payload.get("total_amount", "0"))),
            created_by=request.user,
        )
        for row in payload.get("items", []):
            PurchaseReturnItem.objects.create(
                purchase_return=pr,
                product_id=row["product"],
                quantity=row["quantity"],
                price=row.get("price", 0),
            )
            Product.objects.filter(pk=row["product"]).update(
                current_stock=F("current_stock") - int(row["quantity"])
            )
        po.status = PurchaseOrder.Status.RETURNED
        po.save(update_fields=["status"])
        return Response({"return_id": pr.id}, status=status.HTTP_201_CREATED)
