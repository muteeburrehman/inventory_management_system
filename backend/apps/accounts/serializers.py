from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts import session_store
from apps.accounts.models import (
    PasswordResetToken,
    Permission,
    User,
    UserBranchAccess,
    UserInvitation,
)
from apps.settings_app.models import Branch


class BranchMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ("id", "name", "is_main", "is_active")


class UserSerializer(serializers.ModelSerializer):
    branch = BranchMiniSerializer(read_only=True)
    branches = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "branch",
            "branches",
            "phone",
            "must_change_password",
            "is_active",
        )
        read_only_fields = fields

    @staticmethod
    def get_branches(obj):
        if hasattr(obj, "_prefetched_objects_cache") and "branch_accesses" in obj._prefetched_objects_cache:
            rows = [a.branch for a in obj.branch_accesses.all()]
        else:
            rows = list(
                Branch.objects.filter(user_accesses__user_id=obj.pk)
                .order_by("name")
                .distinct()
            )
        return BranchMiniSerializer(rows, many=True).data


class MeSerializer(UserSerializer):
    module_permissions = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ("module_permissions", "is_staff", "is_superuser")
        read_only_fields = fields

    def get_module_permissions(self, obj):
        cached = self.context.get("module_permissions")
        if cached is not None:
            return cached
        rows = Permission.objects.filter(role=obj.role).order_by("module")
        return PermissionSerializer(rows, many=True).data


class MePatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("branch",)
        extra_kwargs = {"branch": {"allow_null": True, "required": False}}

    def validate_branch(self, branch):
        request = self.context.get("request")
        user = request.user if request else None
        if branch is None or not user:
            return branch
        if user.is_superuser or user.role in (User.Role.SUPER_ADMIN, User.Role.OWNER):
            return branch
        allowed_ids = set(
            UserBranchAccess.objects.filter(user_id=user.pk).values_list("branch_id", flat=True)
        )
        if not allowed_ids and user.branch_id:
            allowed_ids = {user.branch_id}
        if not allowed_ids:
            raise ValidationError(
                "No branch access is assigned to your account. Ask a super admin or owner to add branch access.",
            )
        if branch.id not in allowed_ids:
            raise ValidationError("You do not have access to this branch.")
        if not branch.is_active:
            raise ValidationError("This branch is inactive. Choose an active location or contact an administrator.")
        return branch


class IMSJWTSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        if user.must_change_password:
            token["must_change_password"] = True
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        refresh_str = data["refresh"]
        refresh = RefreshToken(refresh_str)
        uid = refresh["user_id"]
        session_store.add_refresh_session(uid, refresh.get("jti"))
        user = self.user
        mod_perms = PermissionSerializer(
            Permission.objects.filter(role=user.role).order_by("module"),
            many=True,
        ).data
        out = {
            "access_token": data["access"],
            "refresh_token": refresh_str,
            "user": MeSerializer(
                user,
                context={"request": self.context.get("request"), "module_permissions": mod_perms},
            ).data,
            "must_change_password": user.must_change_password,
        }
        return out


class IMSRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])
        uid = refresh["user_id"]
        jti = refresh.get("jti")
        if not session_store.refresh_allowed(uid, jti):
            raise InvalidToken(
                {"detail": "Session revoked or unknown device.", "code": "token_not_valid"},
            )
        data = super().validate(attrs)
        new_refresh = self.token_class(data["refresh"])
        session_store.rotate_refresh_session(uid, jti, new_refresh.get("jti"))
        return data


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = (
            "id",
            "role",
            "module",
            "can_create",
            "can_edit",
            "can_delete",
            "can_print",
            "can_refund",
            "can_view_reports",
        )


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    branch_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
    )
    send_invite = serializers.BooleanField(write_only=True, default=False)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "role",
            "branch",
            "branch_ids",
            "phone",
            "is_staff",
            "is_active",
            "send_invite",
        )

    def validate_username(self, value):
        v = (value or "").strip()
        if not v:
            raise ValidationError("Username may not be empty.")
        qs = User.objects.filter(username=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise ValidationError("A user with this username already exists.")
        return v

    def validate_email(self, value):
        if value is None:
            return ""
        s = str(value).strip()
        if not s:
            return ""
        qs = User.objects.filter(email__iexact=s)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise ValidationError("A user with this email already exists.")
        return s

    def validate(self, attrs):
        send_invite = attrs.pop("send_invite", False)
        if self.instance is None and attrs.get("branch") is not None:
            b = attrs["branch"]
            bid = b.pk
            ids = attrs.get("branch_ids") or []
            if ids and bid not in ids:
                raise ValidationError("Default branch must appear in branch_ids.")
            if not ids:
                attrs["branch_ids"] = [bid]
        pwd = (attrs.get("password") or "").strip()
        if self.instance is None and send_invite and pwd:
            raise ValidationError({"password": "Remove password when sending an invite, or disable invite."})
        if self.instance is None and send_invite and not attrs.get("email"):
            raise ValidationError({"email": "Email is required to send an invitation."})
        if self.instance is None:
            if not attrs.get("branch_ids"):
                raise ValidationError({"branch_ids": "Assign at least one branch."})
        attrs["_send_invite"] = send_invite
        return attrs

    def validate_branch_ids(self, ids):
        if not ids:
            return []
        qs = Branch.objects.filter(pk__in=ids)
        existing = set(qs.values_list("id", flat=True))
        missing = [i for i in ids if i not in existing]
        if missing:
            raise ValidationError(f"Unknown branch id(s): {missing}")
        inactive = list(qs.filter(is_active=False).values_list("id", flat=True))
        if inactive:
            raise ValidationError(f"Inactive branches cannot be assigned: {inactive}")
        return ids

    @transaction.atomic
    def create(self, validated_data):
        branch_ids = validated_data.pop("branch_ids", None) or []
        send_invite = validated_data.pop("_send_invite", False)
        pwd = validated_data.pop("password", None)
        validated_data.pop("send_invite", None)
        user = User(**validated_data)
        if pwd:
            user.set_password(pwd)
        else:
            user.set_unusable_password()
        user.save()
        self._sync_branches(user, branch_ids)
        self._pending_send_invite = bool(send_invite and not pwd)
        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        branch_ids = validated_data.pop("branch_ids", None)
        validated_data.pop("_send_invite", None)
        validated_data.pop("send_invite", None)
        pwd = validated_data.pop("password", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if pwd:
            instance.set_password(pwd)
            instance.must_change_password = False
        instance.save()
        if branch_ids is not None:
            self._sync_branches(instance, branch_ids)
        return instance

    @staticmethod
    def _sync_branches(user: User, branch_ids: list[int]):
        UserBranchAccess.objects.filter(user=user).delete()
        for bid in branch_ids:
            UserBranchAccess.objects.get_or_create(user=user, branch_id=bid)
        if branch_ids:
            if user.branch_id is None or user.branch_id not in branch_ids:
                user.branch_id = branch_ids[0]
                user.save(update_fields=["branch_id"])


class InviteAcceptSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate_password(self, p):
        validate_password(p)
        return p

    def validate(self, attrs):
        raw = attrs["token"]
        digest = UserInvitation.hash_token(raw)
        inv = (
            UserInvitation.objects.select_related("user")
            .filter(token_hash=digest)
            .order_by("-id")
            .first()
        )
        if not inv or not inv.is_valid():
            raise ValidationError({"token": "Invalid or expired invitation."})
        attrs["invitation"] = inv
        return attrs

    @transaction.atomic
    def save(self):
        inv: UserInvitation = self.validated_data["invitation"]
        user = inv.user
        user.set_password(self.validated_data["password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        inv.mark_used()
        now = timezone.now()
        UserInvitation.objects.filter(user=user, used_at__isnull=True).exclude(pk=inv.pk).update(
            used_at=now,
        )
        return user


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, v):
        user = self.context["request"].user
        if not user.check_password(v):
            raise ValidationError("Current password is incorrect.")
        return v

    def validate_new_password(self, p):
        validate_password(p, user=self.context["request"].user)
        return p

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        return user


class PasswordForgotSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate_password(self, p):
        validate_password(p)
        return p

    @transaction.atomic
    def save(self):
        raw = self.validated_data["token"]
        digest = UserInvitation.hash_token(raw)
        row = (
            PasswordResetToken.objects.select_related("user")
            .filter(token_hash=digest, expires_at__gt=timezone.now())
            .first()
        )
        if not row:
            raise ValidationError({"token": "Invalid or expired reset link."})
        user = row.user
        user.set_password(self.validated_data["password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        PasswordResetToken.objects.filter(user=user).delete()
        session_store.clear_refresh_sessions(user.pk)
        return user


class InvitationCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    role = serializers.ChoiceField(choices=User.Role.choices)
    branch_ids = serializers.ListField(child=serializers.IntegerField(min_value=1))

    phone = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_username(self, value):
        v = (value or "").strip()
        if not v:
            raise ValidationError("Username may not be empty.")
        if User.objects.filter(username=v).exists():
            raise ValidationError("This username is already taken.")
        return v

    def validate_email(self, value):
        s = (value or "").strip()
        if not s:
            raise ValidationError("Email is required.")
        if User.objects.filter(email__iexact=s).exists():
            raise ValidationError("A user with this email already exists.")
        return s

    def validate_branch_ids(self, ids):
        if not ids:
            raise ValidationError("Select at least one branch.")
        qs = Branch.objects.filter(pk__in=ids)
        existing = set(qs.values_list("id", flat=True))
        if len(existing) != len(set(ids)):
            raise ValidationError("One or more branches do not exist.")
        if qs.filter(is_active=False).exists():
            raise ValidationError("One or more branches are inactive.")
        return ids

    @transaction.atomic
    def save(self, request, *, invite_hours: int):
        d = self.validated_data
        user = User(
            username=d["username"],
            email=d["email"],
            first_name=d["first_name"],
            last_name=d["last_name"],
            role=d["role"],
            phone=d.get("phone") or "",
        )
        user.set_unusable_password()
        user.branch_id = d["branch_ids"][0]
        user.save()
        for bid in d["branch_ids"]:
            UserBranchAccess.objects.get_or_create(user=user, branch_id=bid)
        raw, _inv = UserInvitation.create_with_token(
            user=user,
            created_by=request.user,
            hours_valid=invite_hours,
        )
        return user, raw
