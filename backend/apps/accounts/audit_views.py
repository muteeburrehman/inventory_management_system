from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import AuditLog, User
from apps.accounts.serializers_audit import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("user").order_by("-timestamp", "-id")
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("module", "action")
    search_fields = ("description", "module", "action")
    envelope_message = "Audit logs."

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser or getattr(user, "role", None) in (
            User.Role.SUPER_ADMIN,
            User.Role.OWNER,
            User.Role.MANAGER,
        ):
            return qs
        return qs.filter(user=user)
