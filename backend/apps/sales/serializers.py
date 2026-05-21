from decimal import Decimal

from rest_framework import serializers

from apps.common.numbering import get_next_document_number
from apps.products.models import Product, ProductVariant

from .models import Coupon, Sale, SaleItem, SplitPayment
from .services import apply_completed_sale, validate_sale_stock


class SplitPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SplitPayment
        fields = ("payment_mode", "amount")


class SaleItemWriteSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    variant = serializers.PrimaryKeyRelatedField(
        queryset=ProductVariant.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = SaleItem
        fields = ("product", "variant", "quantity", "unit_price", "discount", "tax", "subtotal")


class SaleItemReadSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = SaleItem
        fields = (
            "id",
            "product",
            "product_name",
            "sku",
            "variant",
            "quantity",
            "unit_price",
            "discount",
            "tax",
            "subtotal",
        )


class SaleListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sale
        fields = (
            "id",
            "invoice_number",
            "customer",
            "cashier",
            "sale_date",
            "subtotal",
            "discount",
            "tax",
            "total_amount",
            "paid_amount",
            "change_amount",
            "due_amount",
            "payment_mode",
            "status",
            "branch",
            "coupon",
            "notes",
        )


class SaleDetailSerializer(serializers.ModelSerializer):
    items = SaleItemReadSerializer(many=True, read_only=True)
    split_payments = SplitPaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Sale
        fields = SaleListSerializer.Meta.fields + ("items", "split_payments")


class SaleCreateSerializer(serializers.ModelSerializer):
    items = SaleItemWriteSerializer(many=True)
    split_payments = SplitPaymentSerializer(many=True, required=False, default=list)
    coupon_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Sale
        fields = (
            "customer",
            "subtotal",
            "discount",
            "tax",
            "total_amount",
            "paid_amount",
            "change_amount",
            "due_amount",
            "payment_mode",
            "status",
            "branch",
            "coupon",
            "coupon_code",
            "notes",
            "items",
            "split_payments",
        )

    def validate(self, attrs):
        coupon_code = attrs.pop("coupon_code", None)
        if coupon_code and not attrs.get("coupon"):
            from .coupons import resolve_coupon

            subtotal = attrs.get("subtotal", Decimal("0"))
            coupon, discount_amt = resolve_coupon(coupon_code, subtotal)
            attrs["coupon"] = coupon
            attrs["discount"] = (attrs.get("discount") or Decimal("0")) + discount_amt
            total = attrs.get("total_amount", Decimal("0"))
            attrs["total_amount"] = max(total - discount_amt, Decimal("0"))
        items = attrs.get("items", [])
        if attrs.get("status") == Sale.Status.COMPLETED and items:
            validate_sale_stock(items)
        paid = attrs.get("paid_amount", Decimal("0"))
        total = attrs.get("total_amount", Decimal("0"))
        if paid < total and not attrs.get("customer"):
            raise serializers.ValidationError({"customer": "Customer is required for credit sales."})
        cust = attrs.get("customer")
        branch = attrs.get("branch") or self.context["request"].user.branch
        if cust and branch and not cust.branches.filter(pk=branch.pk).exists():
            raise serializers.ValidationError(
                {"customer": "This customer is not linked to this branch. Edit the customer or choose another."}
            )
        if cust and paid < total:
            due = total - paid
            if cust.credit_limit and cust.current_balance + due > cust.credit_limit:
                raise serializers.ValidationError({"customer": "Would exceed customer credit limit."})
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        splits = validated_data.pop("split_payments", [])
        request = self.context["request"]
        user = request.user
        branch = validated_data.get("branch") or user.branch
        if not branch:
            raise serializers.ValidationError({"branch": "User has no default branch; pass branch explicitly."})
        validated_data["branch"] = branch
        validated_data["cashier"] = user
        validated_data["invoice_number"] = get_next_document_number(branch, "INV")
        sale = Sale.objects.create(**validated_data)
        for it in items_data:
            SaleItem.objects.create(sale=sale, **it)
        for sp in splits:
            SplitPayment.objects.create(sale=sale, **sp)
        if sale.status == Sale.Status.COMPLETED:
            apply_completed_sale(sale, user)
        return sale


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = (
            "id",
            "code",
            "discount_type",
            "discount_value",
            "min_order_value",
            "expiry_date",
            "is_active",
        )
