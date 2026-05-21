from rest_framework import serializers

from apps.accounts.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True, default="")

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "username",
            "action",
            "module",
            "description",
            "ip_address",
            "timestamp",
        )
