from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.settings_app.models import Branch

from .models import Permission, User


class BranchMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ("id", "name", "is_main")


class UserSerializer(serializers.ModelSerializer):
    branch = BranchMiniSerializer(read_only=True)

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
            "phone",
        )
        read_only_fields = fields


class MePatchSerializer(serializers.ModelSerializer):
    """Self-service profile update (currently branch assignment only)."""

    class Meta:
        model = User
        fields = ("branch",)
        extra_kwargs = {"branch": {"allow_null": True, "required": False}}


class IMSJWTSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        out = {
            "access_token": data["access"],
            "refresh_token": data["refresh"],
            "user": UserSerializer(self.user).data,
        }
        return out


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
            "phone",
            "is_staff",
            "is_active",
        )

    def create(self, validated_data):
        pwd = validated_data.pop("password", None)
        user = User(**validated_data)
        if pwd:
            user.set_password(pwd)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        pwd = validated_data.pop("password", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if pwd:
            instance.set_password(pwd)
        instance.save()
        return instance
