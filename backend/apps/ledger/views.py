from django.db.models import Sum
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import LedgerEntry
from .serializers import LedgerEntrySerializer


class LedgerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LedgerEntry.objects.select_related("created_by", "branch").order_by(
        "-entry_date", "-id"
    )
    serializer_class = LedgerEntrySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("ledger_type", "branch")
    search_fields = ("description", "reference_number")
    envelope_message = "Ledger."

    @action(detail=False, methods=["get"], url_path="trial-balance")
    def trial_balance(self, request):
        debit = LedgerEntry.objects.aggregate(t=Sum("debit"))["t"] or 0
        credit = LedgerEntry.objects.aggregate(t=Sum("credit"))["t"] or 0
        return Response({"debit_total": str(debit), "credit_total": str(credit)})

    @action(detail=False, methods=["get"], url_path="profit-loss")
    def profit_loss(self, request):
        return Response({"revenue": "0", "cogs": "0", "expenses": "0", "net": "0"})

    @action(detail=False, methods=["get"], url_path="cash-flow")
    def cash_flow(self, request):
        return Response({"inflows": "0", "outflows": "0"})
