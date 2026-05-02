from rest_framework import serializers

from .models import Expense, ExpenseCategory


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ("id", "name")


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = "__all__"
        read_only_fields = ("created_by",)

    def create(self, validated_data):
        request = self.context["request"]
        validated_data["created_by"] = request.user
        if not validated_data.get("branch") and request.user.branch:
            validated_data["branch"] = request.user.branch
        exp = super().create(validated_data)
        from .services import create_expense_ledger

        create_expense_ledger(exp, request.user)
        return exp
