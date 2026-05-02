import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import DatabaseError, OperationalError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from config.api import success_response

from .models import Permission
from .serializers import (
    IMSJWTSerializer,
    MePatchSerializer,
    PermissionSerializer,
    UserSerializer,
    UserWriteSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = IMSJWTSerializer

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            return success_response(serializer.validated_data, message="Login successful.")
        except (OperationalError, DatabaseError) as exc:
            logger.exception("Login database error")
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Database error: "
                    + str(exc)
                    + " — For local dev without PostgreSQL, set USE_SQLITE=true in backend/.env and run migrate.",
                },
                status=503,
            )
        except APIException:
            # Wrong password / unknown user → AuthenticationFailed (401), etc.
            raise
        except Exception as exc:
            logger.exception("Login unexpected error")
            msg = (
                f"{type(exc).__name__}: {exc}"
                if settings.DEBUG
                else "Server error during login. Enable DEBUG in .env to see details, or check the Django terminal."
            )
            return Response({"success": False, "data": {}, "message": msg}, status=500)


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        data = response.data
        return success_response(
            {
                "access_token": data.get("access"),
                "refresh_token": data.get("refresh", request.data.get("refresh")),
            },
            message="Token refreshed.",
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    return success_response({}, message="Logged out. Discard client tokens.")


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me_view(request):
    if request.method == "GET":
        user = User.objects.select_related("branch").get(pk=request.user.pk)
        return success_response(UserSerializer(user).data, message="Profile loaded.")
    ser = MePatchSerializer(instance=request.user, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    user = User.objects.select_related("branch").get(pk=request.user.pk)
    return success_response(UserSerializer(user).data, message="Profile updated.")


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("branch").all()
    serializer_class = UserSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["role", "branch"]
    permission_classes = [IsAdminUser]
    envelope_message = "Users."

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return UserWriteSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            UserSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(UserSerializer(serializer.instance).data)


class PermissionListUpdateAPI(generics.ListAPIView):
    queryset = Permission.objects.all().order_by("role", "module")
    serializer_class = PermissionSerializer
    permission_classes = [IsAdminUser]
    envelope_message = "Permissions."
    pagination_class = None

    def put(self, request, *args, **kwargs):
        rows = request.data if isinstance(request.data, list) else request.data.get("permissions", [])
        for row in rows:
            rid = row.get("id")
            if rid:
                Permission.objects.filter(pk=rid).update(
                    can_create=row.get("can_create", False),
                    can_edit=row.get("can_edit", False),
                    can_delete=row.get("can_delete", False),
                    can_print=row.get("can_print", False),
                    can_refund=row.get("can_refund", False),
                    can_view_reports=row.get("can_view_reports", False),
                )
        return Response(PermissionSerializer(self.get_queryset(), many=True).data)
