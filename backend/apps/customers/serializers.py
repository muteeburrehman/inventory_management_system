from decimal import Decimal

from rest_framework import serializers

from apps.dashboard.scope import assignable_branch_ids, resolve_dashboard_branches
from apps.settings_app.models import Branch

from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    branch_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
    )
    branches = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Customer
        fields = (
            "id",
            "name",
            "phone",
            "email",
            "address",
            "customer_type",
            "opening_balance",
            "credit_limit",
            "current_balance",
            "reward_points",
            "branch_ids",
            "branches",
        )

    def get_branches(self, obj):
        return [{"id": b.id, "name": b.name} for b in obj.branches.all().order_by("name")]

    def validate_branch_ids(self, value):
        if value is not None and len(value) == 0:
            raise serializers.ValidationError("Select at least one branch.")
        return value

    def _validate_ids_subset(self, ids):
        valid = set(
            Branch.objects.filter(is_active=True, pk__in=ids).values_list("id", flat=True)
        )
        if len(valid) != len(set(ids)):
            raise serializers.ValidationError("One or more branches are invalid or inactive.")
        allowed = set(assignable_branch_ids(self.context["request"].user))
        if not allowed:
            raise serializers.ValidationError("You have no branch access to assign.")
        if not set(ids).issubset(allowed):
            raise serializers.ValidationError(
                "You can only link this customer to branches you are allowed to use.",
            )

    def _money_field(self, data, field):
        """Effective value after merging partial update with existing instance."""
        inst = self.instance
        if field in data:
            v = data[field]
            return Decimal("0") if v is None else v
        if inst is not None:
            return getattr(inst, field)
        return Decimal("0")

    def validate(self, data):
        branch_ids = data.get("branch_ids", serializers.empty)
        if branch_ids is not serializers.empty and branch_ids is not None:
            self._validate_ids_subset(branch_ids)

        opening = self._money_field(data, "opening_balance")
        credit = self._money_field(data, "credit_limit")
        if credit > 0 and opening > credit:
            raise serializers.ValidationError(
                {
                    "credit_limit": "Credit limit must be greater than or equal to opening balance.",
                }
            )

        current = self._money_field(data, "current_balance")
        if credit > 0 and current > credit:
            raise serializers.ValidationError(
                {"current_balance": "Current balance cannot exceed credit limit."},
            )

        return data

    def validate_opening_balance(self, value):
        if value is None:
            return Decimal("0")
        return value

    def validate_credit_limit(self, value):
        if value is None:
            return Decimal("0")
        return value

    def validate_current_balance(self, value):
        if value is None:
            return Decimal("0")
        return value

    def validate_reward_points(self, value):
        if value is None:
            return 0
        return value

    def create(self, validated_data):
        branch_ids = validated_data.pop("branch_ids", None)
        if branch_ids is None:
            uid = self.context["request"].user.branch_id
            if uid:
                branch_ids = [uid]
            else:
                raise serializers.ValidationError(
                    {"branch_ids": "Select at least one branch."}
                )
        self._validate_ids_subset(branch_ids)
        opening = validated_data.get("opening_balance") or Decimal("0")
        if "current_balance" not in validated_data or validated_data.get("current_balance") is None:
            validated_data["current_balance"] = opening
        instance = super().create(validated_data)
        instance.branches.set(branch_ids)
        return instance

    def update(self, instance, validated_data):
        branch_ids = validated_data.pop("branch_ids", None)
        instance = super().update(instance, validated_data)
        if branch_ids is not None:
            self._validate_ids_subset(branch_ids)
            instance.branches.set(branch_ids)
        return instance


def filter_customers_queryset_for_user(qs, user):
    branch_ids, meta = resolve_dashboard_branches(user)
    qs = qs.prefetch_related("branches")
    if meta.get("mode") == "denied":
        return qs.none()
    if not branch_ids:
        return qs.none()
    return qs.filter(branches__id__in=branch_ids).distinct()
