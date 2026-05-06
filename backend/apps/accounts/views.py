"""Accounts API: authentication, users, invitations, and permissions."""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import DatabaseError, OperationalError
from django.db.models import Prefetch
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from config.api import error_response, success_response

from apps.accounts import session_store
from apps.accounts.mail import dispatch_invite_email, dispatch_password_reset_email
from apps.accounts.models import PasswordResetToken, Permission, UserBranchAccess, UserInvitation
from apps.accounts.permissions import CanManageUsers, CanManageUsersOrViewSelf, is_privileged_user
from apps.accounts.serializers import (
    IMSJWTSerializer,
    IMSRefreshSerializer,
    InviteAcceptSerializer,
    InvitationCreateSerializer,
    MePatchSerializer,
    MeSerializer,
    PasswordChangeSerializer,
    PasswordForgotSerializer,
    PasswordResetSerializer,
    PermissionSerializer,
    UserSerializer,
    UserWriteSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def _invite_link(raw_token: str) -> str:
    return f"{settings.FRONTEND_BASE_URL}/accept-invite?token={raw_token}"


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = IMSJWTSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

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
    serializer_class = IMSRefreshSerializer

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
    auth = request.headers.get("Authorization") or ""
    refresh = request.data.get("refresh") or request.data.get("refresh_token")
    access_jti = None
    if auth.startswith("Bearer "):
        raw = auth.split(" ", 1)[1].strip()
        try:
            t = AccessToken(raw)
            access_jti = t.get("jti")
        except Exception:
            pass
    if access_jti:
        session_store.block_access_jti(access_jti, settings.ACCESS_TOKEN_LIFETIME_SEC)
    if refresh:
        try:
            r = RefreshToken(refresh)
            uid = r["user_id"]
            session_store.remove_refresh_session(uid, r.get("jti"))
            session_store.block_access_jti(r.access_token["jti"], settings.ACCESS_TOKEN_LIFETIME_SEC)
        except Exception:
            pass
    return success_response({}, message="Session ended.")


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = (
        User.objects.select_related("branch")
        .prefetch_related(
            Prefetch(
                "branch_accesses",
                queryset=UserBranchAccess.objects.select_related("branch"),
            ),
        )
        .get(pk=request.user.pk)
    )
    perms = list(Permission.objects.filter(role=user.role).order_by("module"))
    perm_data = PermissionSerializer(perms, many=True).data
    if request.method == "GET":
        return success_response(
            MeSerializer(
                user,
                context={"request": request, "module_permissions": perm_data},
            ).data,
            message="Profile loaded.",
        )
    ser = MePatchSerializer(instance=user, data=request.data, partial=True, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save()
    user.refresh_from_db()
    user = (
        User.objects.select_related("branch")
        .prefetch_related(
            Prefetch(
                "branch_accesses",
                queryset=UserBranchAccess.objects.select_related("branch"),
            ),
        )
        .get(pk=request.user.pk)
    )
    return success_response(
        MeSerializer(
            user,
            context={"request": request, "module_permissions": perm_data},
        ).data,
        message="Profile updated.",
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def password_change_view(request):
    ser = PasswordChangeSerializer(
        data={
            "old_password": request.data.get("old_password"),
            "new_password": request.data.get("new_password"),
        },
        context={"request": request},
    )
    ser.is_valid(raise_exception=True)
    ser.save()
    refresh = request.data.get("refresh") or request.data.get("refresh_token")
    if refresh:
        try:
            r = RefreshToken(refresh)
            session_store.remove_refresh_session(r["user_id"], r.get("jti"))
        except Exception:
            pass
    session_store.clear_refresh_sessions(request.user.pk)
    return success_response({}, message="Password updated. Please sign in again on all devices.")


@api_view(["POST"])
@permission_classes([AllowAny])
def password_forgot_view(request):
    if not session_store.forgot_password_rate_allow(request.META.get("REMOTE_ADDR", "unknown")):
        return success_response({}, message="If an account exists for that email, a reset link was sent.")
    ser = PasswordForgotSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    email = ser.validated_data["email"].strip().lower()
    user = User.objects.filter(email__iexact=email).first()
    if user:
        raw = PasswordResetToken.issue(user)
        dispatch_password_reset_email(user.email, raw)
    return success_response({}, message="If an account exists for that email, a reset link was sent.")


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_view(request):
    ser = PasswordResetSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    ser.save()
    return success_response({}, message="Password has been reset. You can sign in now.")


@api_view(["POST"])
@permission_classes([AllowAny])
def invite_accept_view(request):
    ser = InviteAcceptSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    ser.save()
    return success_response({}, message="Password set. You can sign in now.")


@api_view(["POST"])
@permission_classes([CanManageUsers])
def invitation_create_view(request):
    ser = InvitationCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    user, raw = ser.save(request, invite_hours=settings.INVITE_LINK_VALID_HOURS)
    dispatch_invite_email(user, raw)
    data = {
        "user": UserSerializer(
            User.objects.prefetch_related(
                Prefetch(
                    "branch_accesses",
                    queryset=UserBranchAccess.objects.select_related("branch"),
                ),
            )
            .select_related("branch")
            .get(pk=user.pk),
        ).data,
        "invite_url": _invite_link(raw),
    }
    return success_response(data, message="Invitation sent.", status=201)


@api_view(["GET"])
@permission_classes([AllowAny])
def invite_preflight_view(request):
    raw = request.GET.get("token") or ""
    if not raw:
        return error_response("Missing token.", status=400)
    d = UserInvitation.hash_token(raw)
    inv = UserInvitation.objects.select_related("user").filter(token_hash=d).order_by("-id").first()
    if not inv or not inv.is_valid():
        return error_response("Invalid or expired invitation.", status=400)
    u = inv.user
    return success_response({"username": u.username, "email": u.email}, message="Invitation valid.")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def otp_login_stub_view(request):
    if not settings.ENABLE_LOGIN_OTP:
        return error_response("Login OTP is not enabled.", status=404)
    return success_response({}, message="OTP flow not implemented.")


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("branch").prefetch_related(
        Prefetch(
            "branch_accesses",
            queryset=UserBranchAccess.objects.select_related("branch"),
        ),
    )
    serializer_class = UserSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["role", "branch"]
    permission_classes = [CanManageUsersOrViewSelf]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if is_privileged_user(user):
            return qs
        return qs.filter(pk=user.pk)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return UserWriteSerializer
        return UserSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        user = serializer.instance
        invite_url = None
        if getattr(serializer, "_pending_send_invite", False):
            raw, _inv = UserInvitation.create_with_token(
                user=user,
                created_by=request.user,
                hours_valid=settings.INVITE_LINK_VALID_HOURS,
            )
            invite_url = _invite_link(raw)
            dispatch_invite_email(user, raw)
        headers = self.get_success_headers(serializer.data)
        body = UserSerializer(
            User.objects.prefetch_related(
                Prefetch(
                    "branch_accesses",
                    queryset=UserBranchAccess.objects.select_related("branch"),
                ),
            )
            .select_related("branch")
            .get(pk=user.pk),
        ).data
        data = dict(body)
        if invite_url:
            data["invite_url"] = invite_url
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        serializer.save()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        user = serializer.instance
        body = UserSerializer(
            User.objects.prefetch_related(
                Prefetch(
                    "branch_accesses",
                    queryset=UserBranchAccess.objects.select_related("branch"),
                ),
            )
            .select_related("branch")
            .get(pk=user.pk),
        ).data
        return Response(body)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.pk == request.user.pk:
            return error_response("You cannot delete your own account.", status=400)
        if instance.is_superuser and not request.user.is_superuser:
            return error_response("Only Django superuser can delete a superuser.", status=403)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PermissionListUpdateAPI(APIView):
    permission_classes = [CanManageUsers]
    envelope_message = "Permissions."

    def get(self, request):
        qs = Permission.objects.all().order_by("role", "module")
        return Response(PermissionSerializer(qs, many=True).data)

    def put(self, request, *args, **kwargs):
        rows = request.data if isinstance(request.data, list) else request.data.get("permissions", [])
        ids = [row.get("id") for row in rows if row.get("id")]
        to_update = list(Permission.objects.filter(pk__in=ids)) if ids else []
        by_id = {p.id: p for p in to_update}
        for row in rows:
            rid = row.get("id")
            if rid and rid in by_id:
                p = by_id[rid]
                p.can_create = row.get("can_create", False)
                p.can_edit = row.get("can_edit", False)
                p.can_delete = row.get("can_delete", False)
                p.can_print = row.get("can_print", False)
                p.can_refund = row.get("can_refund", False)
                p.can_view_reports = row.get("can_view_reports", False)
        if to_update:
            Permission.objects.bulk_update(
                to_update,
                ["can_create", "can_edit", "can_delete", "can_print", "can_refund", "can_view_reports"],
            )
        qs = Permission.objects.all().order_by("role", "module")
        return Response(PermissionSerializer(qs, many=True).data)
