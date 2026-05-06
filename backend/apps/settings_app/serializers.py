from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Branch, BusinessSettings, ShiftClosing

User = get_user_model()


def branch_ids_with_operations():
    """Single round-trip per table; used to flag branches that cannot be hard-deleted."""
    from apps.expenses.models import Expense
    from apps.inventory.models import StockMovement
    from apps.purchases.models import PurchaseOrder
    from apps.sales.models import Sale

    ids = set(Sale.objects.values_list("branch_id", flat=True).distinct())
    ids.update(PurchaseOrder.objects.values_list("branch_id", flat=True).distinct())
    ids.update(StockMovement.objects.values_list("branch_id", flat=True).distinct())
    ids.update(Expense.objects.values_list("branch_id", flat=True).distinct())
    return {i for i in ids if i is not None}


class BranchManagerMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email")


class BranchListSerializer(serializers.ModelSerializer):
    manager = BranchManagerMiniSerializer(read_only=True)
    has_operations = serializers.SerializerMethodField()

    class Meta:
        model = Branch
        fields = (
            "id",
            "name",
            "code",
            "address",
            "phone",
            "email",
            "contact_name",
            "is_main",
            "is_active",
            "manager",
            "has_operations",
        )

    def get_has_operations(self, obj):
        ops = self.context.get("branch_ops_ids")
        if ops is not None:
            return obj.pk in ops
        return obj.pk in branch_ids_with_operations()


class BranchSerializer(BranchListSerializer):
    manager_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True).order_by("username"),
        source="manager",
        write_only=True,
        allow_null=True,
        required=False,
    )

    class Meta(BranchListSerializer.Meta):
        fields = BranchListSerializer.Meta.fields + ("manager_id",)

    def validate_name(self, value):
        text = (value or "").strip()
        if len(text) < 2:
            raise serializers.ValidationError("Name must be at least 2 characters.")
        if len(text) > 255:
            raise serializers.ValidationError("Name is too long.")
        qs = Branch.objects.filter(name=text)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A branch with this name already exists.")
        return text

    def validate_code(self, value):
        if not value:
            return ""
        return value.strip()[:32]

    def validate_phone(self, value):
        if not value:
            return ""
        text = value.strip()
        if len(text) > 50:
            raise serializers.ValidationError("Phone must be at most 50 characters.")
        return text

    def validate_contact_name(self, value):
        if not value:
            return ""
        return value.strip()[:255]

    def validate_manager(self, user):
        if user is None:
            return None
        role = getattr(user, "role", "")
        allowed = role in (
            User.Role.MANAGER,
            User.Role.SUPER_ADMIN,
            User.Role.OWNER,
            User.Role.INVENTORY_MANAGER,
            User.Role.ACCOUNTANT,
            User.Role.SALES_STAFF,
            User.Role.CASHIER,
        )
        if not allowed:
            raise serializers.ValidationError(
                "Assign a staff member with a valid role as branch manager.",
            )
        return user


class BusinessSettingsSerializer(serializers.ModelSerializer):
    branch = BranchListSerializer(read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), source="branch", write_only=True, required=False
    )

    class Meta:
        model = BusinessSettings
        fields = (
            "id",
            "branch",
            "branch_id",
            "business_name",
            "logo",
            "tax_percent",
            "currency",
            "invoice_template",
            "receipt_template",
            "loyalty_points_per_amount",
        )

    def validate_business_name(self, value):
        text = (value or "").strip()
        if len(text) < 2:
            raise serializers.ValidationError("Business name must be at least 2 characters.")
        return text

    def validate_currency(self, value):
        text = (value or "PKR").strip().upper()[:10]
        if len(text) < 3:
            raise serializers.ValidationError("Use a 3-letter currency code (e.g. PKR, USD).")
        return text

    def validate_tax_percent(self, value):
        from decimal import Decimal

        v = value if value is not None else Decimal("0")
        if v < 0 or v > 100:
            raise serializers.ValidationError("Tax must be between 0 and 100.")
        return v


class ShiftClosingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShiftClosing
        fields = "__all__"
        read_only_fields = ("cash_difference", "shift_end", "is_open")
