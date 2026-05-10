from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Brand, Category, Product, ProductVariant
from .serializers import (
    BrandSerializer,
    CategorySerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    ProductVariantInputSerializer,
    ProductVariantReadSerializer,
    ProductWriteSerializer,
)


def _ensure_variant_sku_vs_product(product: Product, sku: str):
    s = (sku or "").strip()
    if not s:
        return
    if s.lower() == (product.sku or "").strip().lower():
        raise ValidationError({"sku": "Variant SKU must differ from the product master SKU."})
    if product.barcode and s.lower() == (product.barcode or "").strip().lower():
        raise ValidationError({"sku": "Variant SKU must differ from the product barcode."})


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.select_related("parent").all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("name", "slug")
    ordering_fields = ("name", "id")
    envelope_message = "Categories."

    def perform_destroy(self, instance):
        if Category.objects.filter(parent=instance).exists():
            raise ValidationError("This category has subcategories. Delete or move them first.")
        if Product.objects.filter(category=instance).exists():
            raise ValidationError("Products are still linked to this category. Reassign them first.")
        instance.delete()

    @action(detail=False, methods=["get"], url_path="tree")
    def tree(self, request):
        rows = list(Category.objects.values("id", "name", "slug", "parent_id"))
        node_ids = {r["id"] for r in rows}
        nodes = {
            r["id"]: {
                "key": r["id"],
                "id": r["id"],
                "name": r["name"],
                "slug": r["slug"],
                "parent_id": r["parent_id"],
                "children": [],
            }
            for r in rows
        }
        roots = []
        for r in rows:
            nid = r["id"]
            node = nodes[nid]
            pid = r["parent_id"]
            if pid is None:
                roots.append(node)
            elif pid in node_ids:
                nodes[pid]["children"].append(node)
            else:
                roots.append(node)

        def sort_tree(ns: list) -> None:
            ns.sort(key=lambda x: (x.get("name") or "").lower())
            for n in ns:
                if n.get("children"):
                    sort_tree(n["children"])

        sort_tree(roots)
        return Response(roots)


class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.order_by("name", "id")
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("name",)
    ordering_fields = ("name", "id")
    envelope_message = "Brands."


class ProductViewSet(viewsets.ModelViewSet):
    queryset = (
        Product.objects.select_related("category", "category__parent", "brand")
        .prefetch_related("variants")
        .all()
    )
    permission_classes = [IsAuthenticated]
    search_fields = ("name", "sku", "barcode")
    ordering_fields = ("name", "sku", "current_stock", "id")
    filterset_fields = ("category", "brand", "status")
    envelope_message = "Products."

    def get_serializer_class(self):
        if self.action in ("retrieve",):
            return ProductDetailSerializer
        if self.action in ("create", "update", "partial_update"):
            return ProductWriteSerializer
        return ProductListSerializer

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        q = request.query_params.get("q", "")
        barcode = request.query_params.get("barcode", "")
        qs = self.filter_queryset(self.get_queryset())
        if barcode:
            qs = qs.filter(barcode=barcode)
        elif q:
            qs = qs.filter(Q(name__icontains=q) | Q(sku__icontains=q) | Q(barcode__icontains=q))
        qs = qs[:100]
        ser = ProductListSerializer(qs, many=True)
        return Response(ser.data)

    @action(detail=True, methods=["get", "post"], url_path="variants")
    def variants(self, request, pk=None):
        product = self.get_object()
        if request.method == "GET":
            ser = ProductVariantReadSerializer(product.variants.all(), many=True)
            return Response(ser.data)
        ser = ProductVariantInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        row = {k: v for k, v in ser.validated_data.items() if k != "id"}
        _ensure_variant_sku_vs_product(product, row["sku"])
        v = ProductVariant.objects.create(product=product, **row)
        return Response(ProductVariantReadSerializer(v).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path=r"variants/(?P<variant_id>[0-9]+)")
    def variant_detail(self, request, pk=None, variant_id=None):
        product = self.get_object()
        v = ProductVariant.objects.filter(pk=variant_id, product_id=product.pk).first()
        if not v:
            raise ValidationError("Variant not found for this product.")
        if request.method == "DELETE":
            v.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        ser = ProductVariantInputSerializer(v, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        if "sku" in ser.validated_data:
            _ensure_variant_sku_vs_product(product, ser.validated_data["sku"])
        for key, val in ser.validated_data.items():
            if key == "id":
                continue
            setattr(v, key, val)
        v.save()
        return Response(ProductVariantReadSerializer(v).data)
