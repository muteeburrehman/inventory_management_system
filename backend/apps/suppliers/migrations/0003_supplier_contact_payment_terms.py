from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("suppliers", "0002_party_branch_links"),
    ]

    operations = [
        migrations.AddField(
            model_name="supplier",
            name="contact_person",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="supplier",
            name="payment_terms",
            field=models.TextField(blank=True, help_text="e.g. Net 30, COD, partial advance."),
        ),
    ]
