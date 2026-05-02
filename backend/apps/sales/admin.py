from django.contrib import admin

from .models import Coupon, Sale, SaleItem, SalesReturn, SalesReturnItem, SplitPayment


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0


class SplitPaymentInline(admin.TabularInline):
    model = SplitPayment
    extra = 0


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "discount_type", "discount_value", "is_active")


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice_number", "status", "branch", "total_amount", "sale_date")
    inlines = [SaleItemInline, SplitPaymentInline]


class SalesReturnItemInline(admin.TabularInline):
    model = SalesReturnItem
    extra = 0


@admin.register(SalesReturn)
class SalesReturnAdmin(admin.ModelAdmin):
    list_display = ("id", "sale", "return_date", "refund_amount")
    inlines = [SalesReturnItemInline]
