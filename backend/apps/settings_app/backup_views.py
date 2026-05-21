import json
from datetime import datetime

from django.apps import apps
from django.core import serializers
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import is_privileged_user

BACKUP_MODELS = [
    "products.Product",
    "products.Category",
    "products.Brand",
    "customers.Customer",
    "suppliers.Supplier",
    "purchases.PurchaseOrder",
    "sales.Sale",
    "expenses.Expense",
    "ledger.LedgerEntry",
    "settings_app.Branch",
    "settings_app.BusinessSettings",
]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def backup_export(request):
    if not is_privileged_user(request.user):
        return Response({"detail": "Only owner or super admin can export backups."}, status=403)

    payload = {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "version": 1,
        "models": {},
    }
    for label in BACKUP_MODELS:
        model = apps.get_model(label)
        qs = model.objects.all()[:5000]
        payload["models"][label] = json.loads(serializers.serialize("json", qs))

    response = HttpResponse(
        json.dumps(payload, indent=2, default=str),
        content_type="application/json",
    )
    response["Content-Disposition"] = (
        f'attachment; filename="ims-backup-{datetime.utcnow().strftime("%Y%m%d-%H%M%S")}.json"'
    )
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def backup_history(request):
    """Placeholder history — extend with BackupJob model when scheduled backups are added."""
    if not is_privileged_user(request.user):
        return Response({"detail": "Forbidden."}, status=403)
    return Response({"history": [], "message": "On-demand export only. Scheduled backups not configured yet."})
