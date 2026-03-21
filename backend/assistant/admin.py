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
	list_display = ("id", "student", "session", "summary_type", "main_category", "created_at")
	list_filter = ("summary_type", "created_at")
	search_fields = ("student__user__email", "student__user__first_name", "student__user__last_name", "content")


@admin.register(AssistantMessage)
class AssistantMessageAdmin(admin.ModelAdmin):
	list_display = ("id", "session", "sender", "sequence", "created_at")
	list_filter = ("sender", "created_at")
	search_fields = ("content", "session__student__user__email")


@admin.register(AssistantSession)
class AssistantSessionAdmin(admin.ModelAdmin):
	list_display = ("id", "student", "mode", "status", "danger_flag", "is_active", "created_at", "ended_at")
	list_filter = ("mode", "status", "danger_flag", "is_active")
	search_fields = ("student__user__email", "student__user__first_name", "student__user__last_name")
