from django.contrib import admin

from .models import Branch, BusinessSettings, DocumentNumberSequence, ShiftClosing


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_main", "phone")


@admin.register(BusinessSettings)
class BusinessSettingsAdmin(admin.ModelAdmin):
    list_display = ("id", "branch", "business_name", "currency")


@admin.register(ShiftClosing)
class ShiftClosingAdmin(admin.ModelAdmin):
    list_display = ("id", "branch", "cashier", "is_open", "shift_start")


@admin.register(DocumentNumberSequence)
class DocumentNumberSequenceAdmin(admin.ModelAdmin):
    list_display = ("id", "branch", "year", "document_type", "last_number")
