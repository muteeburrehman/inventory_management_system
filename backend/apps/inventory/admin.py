from django.contrib import admin

from .models import StockMovement, StockTransfer


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "movement_type", "quantity", "branch", "created_at")


@admin.register(StockTransfer)
class StockTransferAdmin(admin.ModelAdmin):
    list_display = ("id", "from_branch", "to_branch", "product", "quantity", "status")
