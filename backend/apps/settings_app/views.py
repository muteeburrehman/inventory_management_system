from decimal import Decimal

from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from config.api import success_response

from .models import Branch, BusinessSettings, ShiftClosing
from .serializers import BranchSerializer, BusinessSettingsSerializer, ShiftClosingSerializer


class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [IsAuthenticated]
    envelope_message = "Branches."


class BusinessSettingsAPIView(generics.RetrieveUpdateAPIView):
    queryset = BusinessSettings.objects.select_related("branch").all()
    serializer_class = BusinessSettingsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        """Return settings for the user's branch, else first row; bootstrap Main branch + settings if empty."""
        user = self.request.user
        branch = getattr(user, "branch", None)
        qs = BusinessSettings.objects.select_related("branch")
        if branch:
            obj = qs.filter(branch=branch).first()
            if obj:
                return obj
        obj = qs.first()
        if obj:
            return obj
        b = Branch.objects.first()
        if not b:
            b = Branch.objects.create(name="Main", is_main=True)
        return BusinessSettings.objects.create(branch=b, business_name=b.name)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def shift_open(request):
    branch = request.user.branch
    if not branch:
        return Response({"detail": "No branch assigned."}, status=status.HTTP_400_BAD_REQUEST)
    opening = Decimal(str(request.data.get("opening_cash", "0")))
    sc = ShiftClosing.objects.create(
        branch=branch,
        cashier=request.user,
        opening_cash=opening,
        closing_cash=opening,
        shift_start=timezone.now(),
        is_open=True,
    )
    return success_response(ShiftClosingSerializer(sc).data, message="Shift opened.")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def shift_close(request):
    sc = ShiftClosing.objects.filter(cashier=request.user, is_open=True).order_by("-shift_start").first()
    if not sc:
        return Response({"detail": "No open shift."}, status=status.HTTP_400_BAD_REQUEST)
    closing = Decimal(str(request.data.get("closing_cash", "0")))
    total_sales = Decimal(str(request.data.get("total_sales", "0")))
    total_expenses = Decimal(str(request.data.get("total_expenses", "0")))
    sc.closing_cash = closing
    sc.total_sales = total_sales
    sc.total_expenses = total_expenses
    sc.cash_difference = closing - sc.opening_cash - total_sales + total_expenses
    sc.shift_end = timezone.now()
    sc.is_open = False
    sc.save()
    return success_response(ShiftClosingSerializer(sc).data, message="Shift closed.")
