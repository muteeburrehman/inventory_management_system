from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from config.api import error_response, success_response

from .models import Branch, BusinessSettings, ShiftClosing
from .permissions import CanManageBranches, CanViewBranches
from .serializers import (
    BranchListSerializer,
    BranchSerializer,
    BusinessSettingsSerializer,
    ShiftClosingSerializer,
    branch_ids_with_operations,
)


class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.select_related("manager").order_by("name")
    permission_classes = [CanViewBranches]
    envelope_message = "Branches."

    def get_permissions(self):
        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
            "manager_candidates",
        ):
            return [CanManageBranches()]
        return [CanViewBranches()]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return BranchSerializer
        return BranchListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["branch_ops_ids"] = branch_ids_with_operations()
        return ctx

    def get_queryset(self):
        qs = super().get_queryset()
        active = self.request.query_params.get("is_active")
        if active is not None:
            v = active.lower() in ("1", "true", "yes")
            qs = qs.filter(is_active=v)
        q = (self.request.query_params.get("search") or "").strip()
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(code__icontains=q)
                | Q(phone__icontains=q)
                | Q(email__icontains=q)
                | Q(contact_name__icontains=q)
            )
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.pk in branch_ids_with_operations():
            return error_response(
                "This branch has sales, purchases, stock movements, or expenses. "
                "Set it to inactive instead of deleting, or archive data first.",
                status=409,
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=False,
        methods=["get"],
        url_path="manager-candidates",
        permission_classes=[CanManageBranches],
    )
    def manager_candidates(self, request):
        from apps.accounts.models import User

        from .serializers import BranchManagerMiniSerializer

        roles = (
            User.Role.MANAGER,
            User.Role.SUPER_ADMIN,
            User.Role.OWNER,
            User.Role.INVENTORY_MANAGER,
            User.Role.ACCOUNTANT,
            User.Role.SALES_STAFF,
            User.Role.CASHIER,
        )
        qs = User.objects.filter(is_active=True, role__in=roles).order_by("username", "id")[:300]
        data = BranchManagerMiniSerializer(qs, many=True).data
        return Response(data)


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
            b = Branch.objects.create(name="Main", is_main=True, is_active=True)
        return BusinessSettings.objects.create(branch=b, business_name=b.name)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def shift_open(request):
    branch = request.user.branch
    if not branch:
        return Response({"detail": "No branch assigned."}, status=status.HTTP_400_BAD_REQUEST)
    if not branch.is_active:
        return Response({"detail": "This branch is inactive."}, status=status.HTTP_400_BAD_REQUEST)
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