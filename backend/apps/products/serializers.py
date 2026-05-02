from rest_framework import serializers

from .models import Brand, Category, Product, ProductVariant


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "parent", "slug")


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ("id", "name")


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ("id", "product", "size", "color", "model", "sku", "price_modifier", "stock")


class ProductListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    brand = BrandSerializer(read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "sku",
            "barcode",
            "category",
            "brand",
            "unit_type",
            "purchase_price",
            "selling_price",
            "wholesale_price",
            "tax_percent",
            "discount",
            "min_stock_level",
            "opening_stock",
            "current_stock",
            "image",
            "description",
            "status",
        )


class ProductDetailSerializer(ProductListSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ("variants",)


class ProductWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = (
            "name",
            "sku",
            "barcode",
            "category",
            "brand",
            "unit_type",
            "purchase_price",
            "selling_price",
            "wholesale_price",
            "tax_percent",
            "discount",
            "min_stock_level",
            "opening_stock",
            "current_stock",
            "image",
            "description",
            "status",
        )

    def validate_barcode(self, value):
        qs = Product.objects.filter(barcode=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Barcode must be unique.")
        return value


class ProductVariantWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ("size", "color", "model", "sku", "price_modifier", "stock")
