"""Resolve which branches the dashboard aggregates for the current user."""

from __future__ import annotations

from django.db.models import QuerySet

from apps.accounts.models import User, UserBranchAccess
from apps.settings_app.models import Branch


def assignable_branch_ids(user) -> list[int]:
    """
    Branches this user may attach to suppliers/customers (all accessible locations, not only header selection).
    """
    privileged = user.is_superuser or getattr(user, "role", None) in (
        User.Role.SUPER_ADMIN,
        User.Role.OWNER,
    )
    if privileged:
        return list(
            Branch.objects.filter(is_active=True).order_by("id").values_list("id", flat=True)
        )
    ids = list(
        UserBranchAccess.objects.filter(user_id=user.pk, branch__is_active=True)
        .order_by("branch_id")
        .values_list("branch_id", flat=True)
        .distinct()
    )
    if not ids and getattr(user, "branch_id", None):
        ids = [user.branch_id]
    return ids


def resolve_dashboard_branches(user) -> tuple[list[int], dict]:
    """
    Returns (branch_id_list, scope_meta).

    scope_meta keys: mode ('single'|'all'|'multi'|'none'|'denied'), label (str), aggregate_all (bool)
    """
    privileged = user.is_superuser or getattr(user, "role", None) in (
        User.Role.SUPER_ADMIN,
        User.Role.OWNER,
    )

    if user.branch_id:
        if not privileged:
            allowed = set(
                UserBranchAccess.objects.filter(user_id=user.pk).values_list("branch_id", flat=True)
            )
            if not allowed and user.branch_id:
                allowed = {user.branch_id}
            if user.branch_id not in allowed:
                return [], {"mode": "denied", "label": "", "aggregate_all": False}
        name = (
            Branch.objects.filter(pk=user.branch_id).values_list("name", flat=True).first() or ""
        )
        return [user.branch_id], {"mode": "single", "label": name, "aggregate_all": False}

    if privileged:
        ids = list(Branch.objects.filter(is_active=True).order_by("id").values_list("id", flat=True))
        return ids, {"mode": "all", "label": "All branches", "aggregate_all": True}

    ids = list(
        UserBranchAccess.objects.filter(user_id=user.pk, branch__is_active=True)
        .order_by("branch_id")
        .values_list("branch_id", flat=True)
    )
    if not ids:
        return [], {"mode": "none", "label": "", "aggregate_all": False}

    if len(ids) == 1:
        name = Branch.objects.filter(pk=ids[0]).values_list("name", flat=True).first() or ""
        return ids, {"mode": "single", "label": name, "aggregate_all": False}

    names = list(Branch.objects.filter(pk__in=ids).values_list("name", flat=True))
    return ids, {"mode": "multi", "label": ", ".join(names[:5]) + ("…" if len(names) > 5 else ""), "aggregate_all": False}


def filter_by_branches(qs: QuerySet, branch_ids: list[int], field: str = "branch_id"):
    if not branch_ids:
        return qs.none()
    return qs.filter(**{f"{field}__in": branch_ids})


def dashboard_widgets_for_role(role: str) -> dict:
    """Which dashboard blocks this role should see (frontend toggles sections)."""
    r = role or ""
    finance_roles = {
        User.Role.SUPER_ADMIN,
        User.Role.OWNER,
        User.Role.MANAGER,
        User.Role.ACCOUNTANT,
    }
    purchases_roles = {
        User.Role.SUPER_ADMIN,
        User.Role.OWNER,
        User.Role.MANAGER,
        User.Role.ACCOUNTANT,
        User.Role.INVENTORY_MANAGER,
    }
    return {
        "show_master_catalog": True,
        "show_sales_kpis": True,
        "show_revenue_chart": True,
        "show_recent_sales": True,
        "show_purchasing": r in purchases_roles,
        "show_finance_balances": r in finance_roles,
        "show_inventory_health": True,
        "show_profit_card": r in finance_roles,
    }
