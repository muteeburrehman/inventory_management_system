from django.contrib import admin

from .models import Brand, Category, Product, ProductVariant


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0
    fields = ("size", "color", "weight", "volume", "sku", "price_modifier", "stock")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "parent", "slug")


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("id", "name")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "sku", "barcode", "current_stock", "status")
    inlines = [ProductVariantInline]
