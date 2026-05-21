from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("purchases", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchaseitem",
            name="received_quantity",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="purchaseorder",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("partial", "Partially received"),
                    ("received", "Received"),
                    ("cancelled", "Cancelled"),
                    ("returned", "Returned"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
