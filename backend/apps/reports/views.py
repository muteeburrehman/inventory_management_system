from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.products.models import Product


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sales_report(request):
    return Response({"rows": []})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def purchases_report(request):
    return Response({"rows": []})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_report(request):
    low = Product.objects.filter(current_stock__lte=F("min_stock_level")).count()
    return Response({"low_stock_count": low})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profit_report(request):
    return Response({"gross_profit": "0"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def expenses_report(request):
    return Response({"rows": []})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def due_payments_report(request):
    return Response({"customers": [], "suppliers": []})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def day_closing_report(request):
    return Response({"date": str(timezone.localdate())})
