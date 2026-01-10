from django.contrib import admin

from .models import AssistantSession, AssistantMessage, AssistantSessionSummary


# @admin.register(AssistantSession)
# class AssistantSessionAdmin(admin.ModelAdmin):
# 	list_display = ("id", "student", "is_active", "created_at", "ended_at")
# 	list_filter = ("is_active", "created_at", "ended_at")
# 	search_fields = ("student__user__email", "student__user__first_name", "student__user__last_name")


# @admin.register(AssistantMessage)
# class AssistantMessageAdmin(admin.ModelAdmin):
# 	list_display = ("id", "session", "sender", "sequence", "created_at")
# 	list_filter = ("sender", "created_at")
# 	search_fields = ("content", "session__student__user__email")


@admin.register(AssistantSessionSummary)
class AssistantSessionSummaryAdmin(admin.ModelAdmin):
	list_display = ("id", "student", "session", "created_at")
	list_filter = ("created_at",)
	search_fields = ("student__user__email", "student__user__first_name", "student__user__last_name", "content")


admin.site.register(AssistantMessage)
admin.site.register(AssistantSession)