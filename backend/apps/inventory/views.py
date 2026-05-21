from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from config.pagination import IMSPageNumberPagination

from apps.products.models import Product
from apps.products.serializers import ProductListSerializer

from .models import StockMovement, StockTransfer


class InventoryViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    envelope_message = "Inventory."

    @action(detail=False, methods=["get"], url_path="stock")
    def stock(self, request):
        qs = Product.objects.select_related("category", "category__parent", "brand").order_by(
            "name", "id"
        )
        paginator = IMSPageNumberPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        if page is not None:
            return paginator.get_paginated_response(ProductListSerializer(page, many=True).data)
        return Response(ProductListSerializer(qs, many=True).data)

    @action(detail=False, methods=["post"], url_path="adjustment")
    def adjustment(self, request):
        product_id = request.data.get("product")
        qty = int(request.data.get("quantity", 0))
        branch = request.user.branch
        if not branch:
            return Response({"detail": "Branch required."}, status=status.HTTP_400_BAD_REQUEST)
        Product.objects.filter(pk=product_id).update(current_stock=F("current_stock") + qty)
        StockMovement.objects.create(
            product_id=product_id,
            variant_id=request.data.get("variant"),
            movement_type=StockMovement.MovementType.ADJUSTMENT,
            quantity=qty,
            reason=request.data.get("reason", "adjustment"),
            reference=request.data.get("reference", ""),
            branch=branch,
            created_by=request.user,
        )
        return Response({"ok": True}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="transfer")
    def transfer(self, request):
        st = StockTransfer.objects.create(
            from_branch_id=request.data["from_branch"],
            to_branch_id=request.data["to_branch"],
            product_id=request.data["product"],
            quantity=request.data["quantity"],
            status=StockTransfer.Status.PENDING,
        )
        return Response({"id": st.id}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="transfer/complete")
    def complete_transfer(self, request):
        from django.utils import timezone

        transfer_id = request.data.get("id")
        if not transfer_id:
            return Response({"detail": "Transfer id required."}, status=status.HTTP_400_BAD_REQUEST)
        st = StockTransfer.objects.filter(pk=transfer_id, status=StockTransfer.Status.PENDING).first()
        if not st:
            return Response({"detail": "Pending transfer not found."}, status=status.HTTP_404_NOT_FOUND)
        qty = st.quantity
        if st.product.current_stock < qty:
            return Response({"detail": "Insufficient stock to transfer."}, status=status.HTTP_400_BAD_REQUEST)
        Product.objects.filter(pk=st.product_id).update(current_stock=F("current_stock") - qty)
        StockMovement.objects.create(
            product_id=st.product_id,
            movement_type=StockMovement.MovementType.TRANSFER,
            quantity=-qty,
            reason="transfer_out",
            reference=f"TRF-{st.id}",
            branch_id=st.from_branch_id,
            created_by=request.user,
        )
        Product.objects.filter(pk=st.product_id).update(current_stock=F("current_stock") + qty)
        StockMovement.objects.create(
            product_id=st.product_id,
            movement_type=StockMovement.MovementType.TRANSFER,
            quantity=qty,
            reason="transfer_in",
            reference=f"TRF-{st.id}",
            branch_id=st.to_branch_id,
            created_by=request.user,
        )
        st.status = StockTransfer.Status.COMPLETED
        st.transferred_at = timezone.now()
        st.save(update_fields=["status", "transferred_at"])
        return Response({"id": st.id, "status": st.status}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="transfers")
    def transfers(self, request):
        qs = StockTransfer.objects.select_related(
            "from_branch", "to_branch", "product"
        ).order_by("-id")
        from .serializers import StockTransferSerializer

        paginator = IMSPageNumberPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        ser = StockTransferSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return paginator.get_paginated_response(ser.data)
        return Response(ser.data)

    @action(detail=False, methods=["get"], url_path="movements")
    def movements(self, request):
        qs = StockMovement.objects.select_related(
            "product",
            "product__category",
            "product__brand",
            "branch",
            "variant",
            "created_by",
        ).order_by("-created_at", "-id")
        from .serializers import StockMovementSerializer

        paginator = IMSPageNumberPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        if page is not None:
            return paginator.get_paginated_response(StockMovementSerializer(page, many=True).data)
        return Response(StockMovementSerializer(qs, many=True).data)
