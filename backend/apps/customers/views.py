from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.sales.serializers import SaleListSerializer

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("name", "phone", "email")
    ordering_fields = ("name", "id")
    envelope_message = "Customers."

    @action(detail=True, methods=["get"], url_path="ledger")
    def ledger(self, request, pk=None):
        return Response([])

    @action(detail=True, methods=["get"], url_path="purchase-history")
    def purchase_history(self, request, pk=None):
        from apps.sales.models import Sale

        qs = (
            Sale.objects.filter(customer_id=pk)
            .select_related("customer", "cashier", "branch", "coupon")
            .order_by("-sale_date")[:50]
        )
        return Response(SaleListSerializer(qs, many=True).data)
