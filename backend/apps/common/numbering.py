from datetime import date

from django.db import transaction

from apps.settings_app.models import DocumentNumberSequence


def get_next_document_number(branch, document_type: str) -> str:
    """Return next number like INV-2026-00001 or PUR-2026-00001 (per branch/year)."""
    year = date.today().year
    prefix = document_type.upper()
    with transaction.atomic():
        seq, _ = DocumentNumberSequence.objects.select_for_update().get_or_create(
            branch=branch,
            year=year,
            document_type=prefix,
            defaults={"last_number": 0},
        )
        seq.last_number += 1
        seq.save(update_fields=["last_number"])
        return f"{prefix}-{year}-{seq.last_number:05d}"
