from rest_framework import serializers

from .models import StockMovement, StockTransfer


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "product",
            "product_name",
            "product_sku",
            "variant",
            "movement_type",
            "quantity",
            "reason",
            "reference",
            "branch",
            "created_by",
            "created_at",
        )


class StockTransferSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    from_branch_name = serializers.CharField(source="from_branch.name", read_only=True)
    to_branch_name = serializers.CharField(source="to_branch.name", read_only=True)

    class Meta:
        model = StockTransfer
        fields = (
            "id",
            "from_branch",
            "from_branch_name",
            "to_branch",
            "to_branch_name",
            "product",
            "product_name",
            "quantity",
            "status",
            "transferred_at",
        )
