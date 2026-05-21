"""Shared fixtures for modules 7–26 integration tests."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import UserBranchAccess
from apps.products.models import Brand, Category, Product
from apps.settings_app.models import Branch

User = get_user_model()


def jwt_client(user) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")
    return client


def unwrap(response):
    """Return envelope data dict or raw body for non-enveloped endpoints."""
    body = response.json()
    if isinstance(body, dict) and "success" in body:
        assert body.get("success"), body
        return body["data"]
    return body


class ModuleFixturesMixin:
    """Branch, owner user, product catalog for API tests."""

    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(name="Test Branch M726", is_main=True, is_active=True)
        cls.branch_b = Branch.objects.create(name="Test Branch M726 B", is_active=True)
        cls.user = User.objects.create_user(
            username="mod726owner",
            email="mod726@test.com",
            password="testpass123",
        )
        cls.user.role = User.Role.OWNER
        cls.user.branch = cls.branch
        cls.user.save(update_fields=["role", "branch_id"])
        UserBranchAccess.objects.create(user=cls.user, branch=cls.branch)
        UserBranchAccess.objects.create(user=cls.user, branch=cls.branch_b)

        cls.brand = Brand.objects.create(name="M726 Brand")
        cls.category = Category.objects.create(name="M726 Cat", slug="m726-cat")
        cls.product = Product.objects.create(
            name="M726 Widget",
            sku="M726-SKU-001",
            barcode="M726BAR001",
            category=cls.category,
            brand=cls.brand,
            purchase_price=Decimal("5.00"),
            selling_price=Decimal("10.00"),
            current_stock=100,
            min_stock_level=5,
        )
