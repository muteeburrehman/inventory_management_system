import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0002_product_barcode_variant_weight_volume"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="brand",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="categories",
                to="products.brand",
            ),
        ),
    ]
