"""Coupon validation and discount calculation."""

from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers as drf_serializers

from .models import Coupon


def calculate_coupon_discount(coupon: Coupon, subtotal: Decimal) -> Decimal:
    subtotal = Decimal(subtotal)
    if coupon.discount_type == Coupon.DiscountType.PERCENT:
        amount = subtotal * (coupon.discount_value / Decimal("100"))
    else:
        amount = coupon.discount_value
    return min(amount, subtotal).quantize(Decimal("0.01"))


def resolve_coupon(code: str, subtotal: Decimal) -> tuple[Coupon, Decimal]:
    if not code or not str(code).strip():
        raise drf_serializers.ValidationError({"coupon": "Coupon code is required."})
    coupon = Coupon.objects.filter(code__iexact=str(code).strip(), is_active=True).first()
    if not coupon:
        raise drf_serializers.ValidationError({"coupon": "Invalid or inactive coupon."})
    if coupon.expiry_date < timezone.localdate():
        raise drf_serializers.ValidationError({"coupon": "Coupon has expired."})
    subtotal = Decimal(subtotal)
    if subtotal < coupon.min_order_value:
        raise drf_serializers.ValidationError(
            {"coupon": f"Minimum order {coupon.min_order_value} required."}
        )
    return coupon, calculate_coupon_discount(coupon, subtotal)
