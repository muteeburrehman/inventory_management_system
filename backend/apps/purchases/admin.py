from django.contrib import admin

from .models import PurchaseItem, PurchaseOrder, PurchaseReturn, PurchaseReturnItem


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice_number", "supplier", "status", "branch", "purchase_date")
    inlines = [PurchaseItemInline]


class PurchaseReturnItemInline(admin.TabularInline):
    model = PurchaseReturnItem
    extra = 0


@admin.register(PurchaseReturn)
class PurchaseReturnAdmin(admin.ModelAdmin):
    list_display = ("id", "purchase", "return_date", "total_amount")
    inlines = [PurchaseReturnItemInline]
