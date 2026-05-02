from rest_framework import serializers

from apps.common.numbering import get_next_document_number
from apps.products.models import Product, ProductVariant

from .models import PurchaseItem, PurchaseOrder, PurchaseReturn, PurchaseReturnItem
from .services import apply_purchase_received


class PurchaseItemWriteSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    variant = serializers.PrimaryKeyRelatedField(
        queryset=ProductVariant.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = PurchaseItem
        fields = ("product", "variant", "quantity", "purchase_price", "tax", "discount", "subtotal")


class PurchaseItemReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseItem
        fields = "__all__"


class PurchaseListSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrder
        fields = (
            "id",
            "supplier",
            "invoice_number",
            "purchase_date",
            "total_amount",
            "discount",
            "tax",
            "extra_charges",
            "paid_amount",
            "due_amount",
            "payment_mode",
            "status",
            "branch",
            "inventory_applied",
        )


class PurchaseDetailSerializer(serializers.ModelSerializer):
    items = PurchaseItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = PurchaseListSerializer.Meta.fields + ("items",)


class PurchaseWriteSerializer(serializers.ModelSerializer):
    items = PurchaseItemWriteSerializer(many=True)

    class Meta:
        model = PurchaseOrder
        fields = (
            "supplier",
            "purchase_date",
            "total_amount",
            "discount",
            "tax",
            "extra_charges",
            "paid_amount",
            "due_amount",
            "payment_mode",
            "status",
            "branch",
            "items",
        )

    def create(self, validated_data):
        items = validated_data.pop("items")
        request = self.context["request"]
        user = request.user
        branch = validated_data.get("branch") or user.branch
        if not branch:
            raise serializers.ValidationError({"branch": "Branch is required."})
        validated_data["branch"] = branch
        validated_data["invoice_number"] = get_next_document_number(branch, "PUR")
        po = PurchaseOrder.objects.create(**validated_data)
        for it in items:
            PurchaseItem.objects.create(purchase=po, **it)
        if po.status == PurchaseOrder.Status.RECEIVED:
            apply_purchase_received(po, user)
        return po

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        if items is not None:
            instance.items.all().delete()
            for it in items:
                PurchaseItem.objects.create(purchase=instance, **it)
        user = self.context["request"].user
        if instance.status == PurchaseOrder.Status.RECEIVED and not instance.inventory_applied:
            apply_purchase_received(instance, user)
        return instance
