from decimal import Decimal

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

    def validate_quantity(self, value):
        if value is None or value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate_purchase_price(self, value):
        if value is None or value < 0:
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value

    def validate_tax(self, value):
        v = value if value is not None else Decimal("0")
        if v < 0:
            raise serializers.ValidationError("Line tax cannot be negative.")
        return v

    def validate_discount(self, value):
        v = value if value is not None else Decimal("0")
        if v < 0:
            raise serializers.ValidationError("Line discount cannot be negative.")
        return v


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

    def _money(self, data, field):
        """Value from payload or existing instance."""
        inst = self.instance
        if field in data and data[field] is not None:
            return data[field]
        if inst is not None:
            return getattr(inst, field)
        return Decimal("0")

    def validate_total_amount(self, value):
        if value is None or value < 0:
            raise serializers.ValidationError("Total cannot be negative.")
        return value

    def validate_discount(self, value):
        v = value if value is not None else Decimal("0")
        if v < 0:
            raise serializers.ValidationError("Discount cannot be negative.")
        return v

    def validate_tax(self, value):
        v = value if value is not None else Decimal("0")
        if v < 0:
            raise serializers.ValidationError("Tax cannot be negative.")
        return v

    def validate_extra_charges(self, value):
        v = value if value is not None else Decimal("0")
        if v < 0:
            raise serializers.ValidationError("Extra charges cannot be negative.")
        return v

    def validate_paid_amount(self, value):
        v = value if value is not None else Decimal("0")
        if v < 0:
            raise serializers.ValidationError("Paid amount cannot be negative.")
        return v

    def validate_due_amount(self, value):
        v = value if value is not None else Decimal("0")
        if v < 0:
            raise serializers.ValidationError("Due amount cannot be negative.")
        return v

    def validate(self, data):
        inst = self.instance
        supplier = data.get("supplier", getattr(inst, "supplier", None) if inst else None)
        branch = data.get("branch", getattr(inst, "branch", None) if inst else None)
        if branch is None:
            branch = self.context["request"].user.branch
        if supplier and branch and not supplier.branches.filter(pk=branch.pk).exists():
            raise serializers.ValidationError(
                {"supplier": "This supplier is not linked to this branch. Edit the supplier or choose another."}
            )

        total = self._money(data, "total_amount")
        paid = self._money(data, "paid_amount")
        due = self._money(data, "due_amount")
        if paid + due != total:
            diff = abs(paid + due - total)
            if diff > Decimal("0.02"):
                raise serializers.ValidationError(
                    {
                        "due_amount": f"Paid ({paid}) + Due ({due}) must equal Total ({total}). Fix one of these amounts.",
                        "paid_amount": f"Paid ({paid}) + Due ({due}) must equal Total ({total}). Fix one of these amounts.",
                    }
                )

        items = data.get("items")
        if items is not None and len(items) == 0:
            raise serializers.ValidationError({"items": "Add at least one product line."})

        return data

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
