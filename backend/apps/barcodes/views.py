from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.products.models import Product
from apps.products.serializers import ProductListSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lookup_barcode(request):
    code = request.query_params.get("code", "")
    p = (
        Product.objects.filter(barcode=code)
        .select_related("category", "category__parent", "brand")
        .first()
    )
    if not p:
        return Response({"found": False, "product": None})
    return Response({"found": True, "product": ProductListSerializer(p).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def generate_barcode(request):
    sku = request.query_params.get("sku", "")
    return Response({"barcode_value": sku, "format": "CODE128"})
