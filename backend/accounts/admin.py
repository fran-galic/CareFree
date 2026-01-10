from django.contrib import admin
from .models import User, Student, Caretaker, HelpCategory, CaretakerCV, Diploma
from django.core.mail import send_mail
from django.conf import settings
from django.utils.html import format_html


class DiplomaInline(admin.TabularInline):
    model = Diploma
    extra = 0
    readonly_fields = ('file_link', 'diploma_type', 'uploaded_at')

    def file_link(self, obj):
        if obj and obj.file:
            return format_html('<a href="{}" target="_blank">{}</a>', obj.file.url, obj.original_filename or 'file')
        return '-'
    file_link.short_description = 'File'


class CaretakerCVInline(admin.StackedInline):
    model = CaretakerCV
    max_num = 1
    extra = 0
    fields = ('file', 'file_link', 'uploaded_at')
    readonly_fields = ('file_link', 'uploaded_at')

    def file_link(self, obj):
        if obj and getattr(obj, 'file', None):
            return format_html('<a href="{}" target="_blank">{}</a>', obj.file.url, obj.original_filename or 'CV')
        return '-'
    file_link.short_description = 'CV'


# Register your models here.
class CaretakerAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'user', 'cv_link', 'diplomas_count', 'is_profile_complete', 'is_approved', 'approval_status')
    search_fields = ('user__email',)
    filter_horizontal = ('help_categories',)
    actions = ['approve_caretakers', 'deny_caretakers']
    inlines = [CaretakerCVInline, DiplomaInline]

    def cv_link(self, obj):
        try:
            cv = obj.cv
        except Exception:
            cv = None
        if cv and cv.file:
            return format_html('<a href="{}" target="_blank">{}</a>', cv.file.url, cv.original_filename or 'CV')
        return '-'
    cv_link.short_description = 'CV'

    def diplomas_count(self, obj):
        return obj.diplomas.count()
    diplomas_count.short_description = 'Diplomas'

    def approve_caretakers(self, request, queryset):
        updated = 0
        for ct in queryset:
            if getattr(ct, 'approval_status', None) != getattr(ct, 'APPROVAL_APPROVED', 'APPROVED'):
                # set approval_status; `sync_caretaker_approval` signal will update `is_approved`
                try:
                    ct.approval_status = ct.APPROVAL_APPROVED
                except Exception:
                    pass
                ct.save()
                
                # fallback to synchronous send_mail
                subject = 'CareFree - account approved'
                message = 'Vaš račun njegovatelja je odobren. Sada možete koristiti aplikaciju.'
                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None)
                try:
                    send_mail(subject, message, from_email, [ct.user.email])
                except Exception:
                    pass
                updated += 1
        self.message_user(request, f"Approved {updated} caretakers.")
    approve_caretakers.short_description = 'Approve selected caretakers and notify them'

    def deny_caretakers(self, request, queryset):
        updated = 0
        for ct in queryset:
            if getattr(ct, 'approval_status', None) != getattr(ct, 'APPROVAL_DENIED', 'DENIED'):
                # set approval_status; signal will clear `is_approved`
                try:
                    ct.approval_status = ct.APPROVAL_DENIED
                except Exception:
                    pass
                ct.save()
                # notify user of denial (synchronous fallback)
                subject = 'CareFree - account denied'
                message = 'Vaš račun njegovatelja je odbijen. Obratite se administratoru za detalje.'
                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None)
                try:
                    send_mail(subject, message, from_email, [ct.user.email])
                except Exception:
                    pass
                updated += 1
        self.message_user(request, f"Denied {updated} caretakers.")
    deny_caretakers.short_description = 'Deny selected caretakers and notify them'


@admin.register(HelpCategory)
class HelpCategoryAdmin(admin.ModelAdmin):
    list_display = ('label', 'slug', 'parent')
    search_fields = ('label', 'slug')
    list_filter = ('parent',)
    prepopulated_fields = {'slug': ('label',)}


admin.site.register(User)
admin.site.register(Student)
admin.site.register(Caretaker, CaretakerAdmin)

admin.site.site_header = "CareFree Administration"
admin.site.site_title = "CareFree Admin Page"
admin.site.index_title = "CareFree Admin"