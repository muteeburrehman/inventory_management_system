from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="barcode",
            field=models.CharField(blank=True, max_length=100, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="productvariant",
            name="volume",
            field=models.DecimalField(
                decimal_places=3,
                default=0,
                help_text="Optional volume (e.g. L) for this variant.",
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="productvariant",
            name="weight",
            field=models.DecimalField(
                decimal_places=3,
                default=0,
                help_text="Optional weight (e.g. kg) for this variant.",
                max_digits=12,
            ),
        ),
    ]
