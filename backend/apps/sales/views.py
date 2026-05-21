from django.core.mail import send_mail
from django.conf import settings
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from config.pagination import IMSPageNumberPagination

from apps.accounts.permissions import CanRefund, is_privileged_user

from .coupons import resolve_coupon
from .models import Coupon, Sale, SalesReturn, SalesReturnItem
from .serializers import (
    CouponSerializer,
    SaleCreateSerializer,
    SaleDetailSerializer,
    SaleListSerializer,
)
from .services import apply_sales_return, cancel_completed_sale


def _sale_for_detail(pk: int) -> Sale:
    return (
        Sale.objects.select_related("customer", "cashier", "branch", "coupon")
        .prefetch_related("items__product", "items__variant", "split_payments")
        .get(pk=pk)
    )


class SaleViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Sale.objects.select_related("customer", "cashier", "branch", "coupon").prefetch_related(
        "items__product",
        "items__variant",
        "split_payments",
    )
    permission_classes = [IsAuthenticated]
    filterset_fields = ("status", "branch", "customer")
    search_fields = ("invoice_number",)
    ordering_fields = ("sale_date", "id", "total_amount")
    envelope_message = "Sales."

    def get_permissions(self):
        if self.action in ("submit_return", "cancel"):
            return [IsAuthenticated(), CanRefund()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return SaleCreateSerializer
        if self.action == "retrieve":
            return SaleDetailSerializer
        return SaleListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        sale = _sale_for_detail(serializer.instance.pk)
        read = SaleDetailSerializer(sale, context={"request": request})
        return Response(read.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="hold")
    def hold(self, request):
        data = {**request.data, "status": Sale.Status.HELD}
        ser = SaleCreateSerializer(data=data, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        sale = _sale_for_detail(ser.instance.pk)
        return Response(SaleDetailSerializer(sale, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="held")
    def held(self, request):
        qs = self.get_queryset().filter(status=Sale.Status.HELD)
        if request.user.branch_id:
            qs = qs.filter(branch=request.user.branch_id)
        qs = qs.order_by("-sale_date", "-id")
        paginator = IMSPageNumberPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        ser = SaleListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return paginator.get_paginated_response(ser.data)
        return Response(ser.data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        sale = self.get_object()
        cancel_completed_sale(sale, request.user)
        sale = _sale_for_detail(sale.pk)
        return Response(SaleDetailSerializer(sale, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="email-receipt")
    def email_receipt(self, request, pk=None):
        sale = self.get_object()
        email = (request.data.get("email") or "").strip()
        if not email and sale.customer_id:
            email = (sale.customer.email or "").strip()
        if not email:
            return Response({"detail": "Email address required."}, status=status.HTTP_400_BAD_REQUEST)
        subject = f"Receipt {sale.invoice_number}"
        body = (
            f"Thank you for your purchase.\n\n"
            f"Invoice: {sale.invoice_number}\n"
            f"Date: {sale.sale_date}\n"
            f"Total: {sale.total_amount}\n"
            f"Paid: {sale.paid_amount}\n"
        )
        try:
            send_mail(
                subject,
                body,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": f"Could not send email: {exc}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"ok": True, "email": email})

    @action(detail=True, methods=["post"], url_path="return")
    def submit_return(self, request, pk=None):
        sale = self.get_object()
        payload = request.data
        items = payload.get("items", [])
        sret = SalesReturn.objects.create(
            sale=sale,
            return_date=payload.get("return_date") or sale.sale_date.date(),
            return_type=payload.get("return_type", SalesReturn.ReturnType.PARTIAL),
            refund_amount=payload.get("refund_amount", 0),
            reason=payload.get("reason", ""),
            created_by=request.user,
        )
        for row in items:
            SalesReturnItem.objects.create(
                sales_return=sret,
                product_id=row["product"],
                quantity=row["quantity"],
                price=row.get("price", 0),
            )
        apply_sales_return(sret, request.user)
        return Response({"return_id": sret.id}, status=status.HTTP_201_CREATED)


class CouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all()
    serializer_class = CouponSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("code",)
    ordering_fields = ("code", "expiry_date", "id")
    envelope_message = "Coupons."

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), _PrivilegedCouponPermission()]
        return super().get_permissions()


class _PrivilegedCouponPermission(BasePermission):
    message = "Only owner or super admin can manage coupons."

    def has_permission(self, request, view):
        return request.user.is_authenticated and is_privileged_user(request.user)

    @action(detail=False, methods=["post"], url_path="validate")
    def validate_coupon(self, request):
        from decimal import Decimal

        code = request.data.get("code", "")
        subtotal = Decimal(str(request.data.get("subtotal", "0")))
        coupon, discount = resolve_coupon(code, subtotal)
        return Response(
            {
                "coupon_id": coupon.id,
                "code": coupon.code,
                "discount_type": coupon.discount_type,
                "discount_value": str(coupon.discount_value),
                "discount_amount": str(discount),
            }
        )
