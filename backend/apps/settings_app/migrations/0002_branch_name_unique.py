from collections import defaultdict

from django.db import migrations, models


def dedupe_branch_names(apps, schema_editor):
    Branch = apps.get_model("settings_app", "Branch")
    by_name = defaultdict(list)
    for row in Branch.objects.all().order_by("id"):
        key = (row.name or "").strip() or f"__empty_{row.pk}"
        by_name[key].append(row)
    for _key, rows in by_name.items():
        if len(rows) < 2:
            continue
        for b in rows[1:]:
            base = (rows[0].name or "Branch").strip() or "Branch"
            candidate = f"{base} ({b.pk})"
            if len(candidate) > 255:
                candidate = f"{base[:230]}… ({b.pk})"[:255]
            if Branch.objects.filter(name=candidate).exclude(pk=b.pk).exists():
                candidate = f"Branch #{b.pk}"[:255]
            b.name = candidate
            b.save(update_fields=["name"])


class Migration(migrations.Migration):

    dependencies = [
        ("settings_app", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(dedupe_branch_names, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="branch",
            name="name",
            field=models.CharField(max_length=255, unique=True),
        ),
    ]
