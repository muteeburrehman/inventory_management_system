from rest_framework import serializers

from .models import Branch, BusinessSettings, ShiftClosing


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ("id", "name", "address", "phone", "is_main")

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

    def validate_phone(self, value):
        if not value:
            return ""
        text = value.strip()
        if len(text) > 50:
            raise serializers.ValidationError("Phone must be at most 50 characters.")
        return text


class BusinessSettingsSerializer(serializers.ModelSerializer):
    branch = BranchSerializer(read_only=True)
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
