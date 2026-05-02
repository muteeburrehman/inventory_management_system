import django.db.models.deletion
from django.db import migrations, models


def backfill_ledger_branch(apps, schema_editor):
    LedgerEntry = apps.get_model("ledger", "LedgerEntry")
    Sale = apps.get_model("sales", "Sale")
    PurchaseOrder = apps.get_model("purchases", "PurchaseOrder")
    Expense = apps.get_model("expenses", "Expense")

    for e in LedgerEntry.objects.filter(branch__isnull=True).iterator():
        bid = None
        if e.ledger_type == "sales":
            s = Sale.objects.filter(pk=e.reference_id).first()
            bid = s.branch_id if s else None
        elif e.ledger_type == "purchase":
            po = PurchaseOrder.objects.filter(pk=e.reference_id).first()
            bid = po.branch_id if po else None
        elif e.ledger_type == "expense":
            ex = Expense.objects.filter(pk=e.reference_id).first()
            bid = ex.branch_id if ex else None
        if bid:
            e.branch_id = bid
            e.save(update_fields=["branch_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("ledger", "0001_initial"),
        ("settings_app", "0002_branch_name_unique"),
        ("sales", "0001_initial"),
        ("purchases", "0001_initial"),
        ("expenses", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="ledgerentry",
            name="branch",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="ledger_entries",
                to="settings_app.branch",
            ),
        ),
        migrations.RunPython(backfill_ledger_branch, migrations.RunPython.noop),
    ]
