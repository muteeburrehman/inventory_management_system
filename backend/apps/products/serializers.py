from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import Brand, Category, Product, ProductVariant


class CategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.SerializerMethodField()
    brand_name = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ("id", "name", "parent", "brand", "slug", "parent_name", "brand_name")
        read_only_fields = ("slug",)

    def get_parent_name(self, obj):
        return obj.parent.name if obj.parent_id else None

    def get_brand_name(self, obj):
        return obj.brand.name if obj.brand_id else None

    def validate_name(self, value):
        s = (value or "").strip()
        if not s:
            raise serializers.ValidationError("Category name is required.")
        if len(s) > 255:
            raise serializers.ValidationError("Name is too long.")
        return s

    def validate(self, attrs):
        parent = attrs.get("parent", serializers.empty)
        inst = self.instance
        if parent is serializers.empty:
            return attrs
        parent = attrs.get("parent")

        if parent is None:
            return attrs

        if inst and inst.pk:
            if parent.pk == inst.pk:
                raise serializers.ValidationError({"parent": "A category cannot be its own parent."})
            walk = parent
            while walk:
                if walk.pk == inst.pk:
                    raise serializers.ValidationError(
                        {"parent": "Cannot set parent to this category or one of its descendants."}
                    )
                walk = walk.parent

        return attrs


class CategoryNestedSerializer(serializers.ModelSerializer):
    """Category on product detail with parent hint for sub-category display."""

    parent_id = serializers.IntegerField(read_only=True)
    parent_name = serializers.SerializerMethodField()
    brand_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ("id", "name", "slug", "parent_id", "parent_name", "brand_id")

    def get_parent_name(self, obj):
        return obj.parent.name if obj.parent_id else None


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ("id", "name")


class ProductVariantReadSerializer(serializers.ModelSerializer):
    """Variant payload returned on product detail (no redundant product FK)."""

    class Meta:
        model = ProductVariant
        fields = ("id", "size", "color", "weight", "volume", "sku", "price_modifier", "stock")


class ProductListSerializer(serializers.ModelSerializer):
    category = CategoryNestedSerializer(read_only=True)
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
    variants = ProductVariantReadSerializer(many=True, read_only=True)

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ("variants",)


def _norm_sku(value: str) -> str:
    return (value or "").strip()


class ProductVariantInputSerializer(serializers.ModelSerializer):
    """Variant row for create/update (optional id for existing rows on product update)."""

    id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = ProductVariant
        fields = ("id", "size", "color", "weight", "volume", "sku", "price_modifier", "stock")
        # ProductVariant.sku is `unique=True`, so DRF auto-attaches a UniqueValidator.
        # That validator has no idea this row may already *be* the variant it's
        # comparing against when we're nested inside a product PATCH, which would
        # cause a 400 ("product variant with this sku already exists") on every
        # no-op edit. Disable it here — `validate_sku()` below performs the
        # uniqueness check with proper self-exclusion via the row's id.
        extra_kwargs = {"sku": {"validators": []}}

    def _parent_product_pk(self, row_id=None):
        """The pk of the product this variant belongs to, used to exclude the
        product itself when checking the variant SKU against master SKUs and
        barcodes of other products."""
        # When used standalone (e.g. PATCH on the /variants/<id>/ detail action)
        # self.instance is set.
        inst = getattr(self, "instance", None)
        if getattr(inst, "product_id", None):
            return inst.product_id
        # When nested under ProductWriteSerializer, walk the serializer tree:
        # row -> ListSerializer -> ProductWriteSerializer (whose .instance is
        # the Product on PATCH).
        parent = getattr(self, "parent", None)
        while parent is not None:
            pinst = getattr(parent, "instance", None)
            if isinstance(pinst, Product):
                return pinst.pk
            parent = getattr(parent, "parent", None)
        # Last fallback: look it up from the row id, when provided.
        if row_id:
            v = ProductVariant.objects.filter(pk=row_id).only("product_id").first()
            if v:
                return v.product_id
        return None

    def validate_sku(self, value):
        # Only do the cheap, content-only checks here. The uniqueness lookups
        # that need to know about the row id (for self-exclusion on edits) are
        # done in the object-level `validate()` below where `attrs` includes
        # the id field.
        s = _norm_sku(value)
        if not s:
            raise serializers.ValidationError("Variant SKU is required.")
        if len(s) > 100:
            raise serializers.ValidationError("Variant SKU must be at most 100 characters.")
        return s

    def validate(self, attrs):
        sku = _norm_sku(attrs.get("sku", "") or getattr(self.instance, "sku", "") or "")
        if not sku:
            # validate_sku already enforced "required" — bail out cleanly.
            return attrs

        # Resolve which variant this row is so we can exclude it from the
        # uniqueness checks. Prefer `self.instance` (standalone use), then the
        # explicit `id` carried in the row (nested-under-product use).
        existing = getattr(self, "instance", None)
        row_id = attrs.get("id")
        if not getattr(existing, "pk", None) and row_id:
            existing = ProductVariant.objects.filter(pk=row_id).first()

        product_pk = self._parent_product_pk(row_id=row_id)

        qs = ProductVariant.objects.filter(sku__iexact=sku)
        if existing:
            qs = qs.exclude(pk=existing.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {"sku": "This variant SKU is already in use."}
            )

        qp = Product.objects.filter(sku__iexact=sku)
        if product_pk:
            qp = qp.exclude(pk=product_pk)
        if qp.exists():
            raise serializers.ValidationError(
                {"sku": "Variant SKU matches another product's master SKU."}
            )

        qb = (
            Product.objects.exclude(barcode__isnull=True)
            .exclude(barcode__exact="")
            .filter(barcode__iexact=sku)
        )
        if product_pk:
            qb = qb.exclude(pk=product_pk)
        if qb.exists():
            raise serializers.ValidationError(
                {"sku": "Variant SKU matches another product barcode."}
            )

        return attrs

    def validate_weight(self, value):
        if value is None:
            return Decimal("0")
        if value < 0:
            raise serializers.ValidationError("Weight cannot be negative.")
        return value

    def validate_volume(self, value):
        if value is None:
            return Decimal("0")
        if value < 0:
            raise serializers.ValidationError("Volume cannot be negative.")
        return value

    def validate_price_modifier(self, value):
        if value is None:
            return Decimal("0")
        return value


class ProductWriteSerializer(serializers.ModelSerializer):
    variants = ProductVariantInputSerializer(many=True, required=False)

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
            "variants",
        )

    def validate_name(self, value):
        s = (value or "").strip()
        if not s:
            raise serializers.ValidationError("Product name is required.")
        return s

    def validate_sku(self, value):
        s = _norm_sku(value)
        if not s:
            raise serializers.ValidationError("SKU is required.")
        qs = Product.objects.filter(sku=s)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("SKU must be unique.")
        return s

    def validate_barcode(self, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        s = _norm_sku(value)
        qs = Product.objects.filter(barcode=s)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Barcode must be unique.")
        return s

    def validate_tax_percent(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("GST/Tax percent must be between 0 and 100.")
        return value

    def validate_discount(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Discount percent must be between 0 and 100.")
        return value

    def validate_purchase_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Cost price cannot be negative.")
        return value

    def validate_selling_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Selling price cannot be negative.")
        return value

    def validate_wholesale_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Wholesale price cannot be negative.")
        return value

    def validate_variants(self, rows):
        if not rows:
            return rows
        skus = []
        for row in rows:
            s = _norm_sku(row["sku"])
            skus.append(s.lower())
        if len(skus) != len(set(skus)):
            raise serializers.ValidationError("Duplicate variant SKUs in the request.")
        return rows

    def validate(self, attrs):
        variants = attrs.get("variants")
        if variants is None and self.instance is None:
            attrs.setdefault("variants", [])
            variants = attrs["variants"]

        sku = attrs.get("sku") or (self.instance.sku if self.instance else "")
        sku_l = _norm_sku(str(sku)).lower()
        if variants:
            bar = attrs.get("barcode", serializers.empty)
            if bar is serializers.empty:
                barcode_l = (
                    (_norm_sku(self.instance.barcode).lower())
                    if self.instance and self.instance.barcode
                    else None
                )
            else:
                barcode_l = _norm_sku(bar).lower() if bar else None
            for row in variants:
                vsku = _norm_sku(row["sku"]).lower()
                if sku_l == vsku:
                    raise serializers.ValidationError(
                        {"variants": "Variant SKUs must differ from the product master SKU."}
                    )
                if barcode_l and vsku == barcode_l:
                    raise serializers.ValidationError(
                        {"variants": "Variant SKU cannot match the product barcode."}
                    )

        clash = serializers.ValidationError(
            "This SKU is already used by a product variant.",
        )
        sku_check = attrs.get("sku") or (self.instance.sku if self.instance else None)
        if sku_check:
            qs = ProductVariant.objects.filter(sku__iexact=_norm_sku(sku_check))
            if self.instance:
                qs = qs.exclude(product=self.instance)
            if qs.exists():
                raise clash
        bar_check = attrs.get("barcode", serializers.empty)
        if bar_check is serializers.empty:
            bar_check = self.instance.barcode if self.instance else None
        if bar_check:
            qs = ProductVariant.objects.filter(sku__iexact=_norm_sku(bar_check))
            if self.instance:
                qs = qs.exclude(product=self.instance)
            if qs.exists():
                raise serializers.ValidationError({"barcode": "This barcode matches an existing variant SKU."})

        purchase = attrs.get("purchase_price", serializers.empty)
        if purchase is serializers.empty:
            purchase = self.instance.purchase_price if self.instance else None
        selling = attrs.get("selling_price", serializers.empty)
        if selling is serializers.empty:
            selling = self.instance.selling_price if self.instance else None
        wholesale = attrs.get("wholesale_price", serializers.empty)
        if wholesale is serializers.empty:
            wholesale = self.instance.wholesale_price if self.instance else None

        if purchase is not None and selling is not None and selling < purchase:
            raise serializers.ValidationError(
                {"selling_price": "Selling price cannot be less than cost price."},
            )
        if wholesale is not None and selling is not None and wholesale > selling:
            raise serializers.ValidationError(
                {"wholesale_price": "Wholesale price cannot be greater than selling price."},
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        variants_data = validated_data.pop("variants", []) or []
        product = Product.objects.create(**validated_data)
        for row in variants_data:
            row = dict(row)
            row.pop("id", None)
            ProductVariant.objects.create(product=product, **row)
        return product

    @transaction.atomic
    def update(self, instance, validated_data):
        variants_data = validated_data.pop("variants", None)
        instance = super().update(instance, validated_data)

        if variants_data is not None:
            seen_ids = set()
            for row in variants_data:
                row_copy = dict(row)
                vid = row_copy.pop("id", None)
                if vid is not None:
                    v_obj = ProductVariant.objects.filter(pk=vid, product=instance).first()
                    if not v_obj:
                        raise serializers.ValidationError(
                            {"variants": f"No variant #{vid} for this product."}
                        )
                    for k, v in row_copy.items():
                        setattr(v_obj, k, v)
                    v_obj.save()
                    seen_ids.add(v_obj.pk)
                else:
                    row_copy.pop("id", None)
                    n = ProductVariant.objects.create(product=instance, **row_copy)
                    seen_ids.add(n.pk)
            instance.variants.exclude(pk__in=seen_ids).delete()
        return instance
