from django.db.models import Q
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "title", "message", "notification_type", "is_read", "created_at")


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Notification.objects.select_related("user", "related_product").order_by("-created_at")
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    envelope_message = "Notifications."

    def list(self, request, *args, **kwargs):
        from .services import ensure_due_payment_alerts

        ensure_due_payment_alerts()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_authenticated:
            return qs.filter(Q(user__isnull=True) | Q(user=self.request.user))
        return qs.none()

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        self.get_queryset().filter(pk=pk).update(is_read=True)
        return Response({"ok": True})

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        self.get_queryset().update(is_read=True)
        return Response({"ok": True}, status=status.HTTP_200_OK)
