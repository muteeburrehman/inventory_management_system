from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Brand, Category, Product, ProductVariant
from .serializers import (
    BrandSerializer,
    CategorySerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    ProductVariantSerializer,
    ProductVariantWriteSerializer,
    ProductWriteSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.select_related("parent").all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("name", "slug")
    ordering_fields = ("name", "id")
    envelope_message = "Categories."


class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all()
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
            data = ProductVariantSerializer(product.variants.all(), many=True).data
            return Response(data)
        ser = ProductVariantWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = ProductVariant.objects.create(product=product, **ser.validated_data)
        return Response(ProductVariantSerializer(v).data, status=status.HTTP_201_CREATED)
