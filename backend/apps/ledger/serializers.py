from rest_framework import serializers

from apps.accounts.serializers import BranchMiniSerializer

from .models import LedgerEntry


class LedgerEntrySerializer(serializers.ModelSerializer):
    branch = BranchMiniSerializer(read_only=True)

    class Meta:
        model = LedgerEntry
        fields = (
            "id",
            "ledger_type",
            "reference_id",
            "description",
            "debit",
            "credit",
            "balance",
            "reference_number",
            "entry_date",
            "created_by",
            "branch",
        )
