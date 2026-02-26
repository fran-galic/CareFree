from django.contrib import admin
from .models import Certificate, User, Student, Caretaker, HelpCategory, CaretakerCV, Diploma
from django.conf import settings
from django.utils.html import format_html
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from backend.emailing import send_transactional_email


def _send_caretaker_status_email(caretaker, approved: bool):
    """Send approval or denial email to a caretaker.

    The function determines subject and message based on `approved` and
    uses project email settings. Exceptions during send are swallowed to
    avoid breaking admin actions.
    """
    if not getattr(caretaker, 'user', None) or not getattr(caretaker.user, 'email', None):
        return

    if approved:
        subject = 'CareFree - korisnički račun je odobren'
        message_text = 'Vaš račun njegovatelja je odobren. Sada možete koristiti aplikaciju.'
    else:
        subject = 'CareFree - korisnički račun je odbijen'
        message_text = 'Vaš račun njegovatelja je odbijen. Obratite se administratoru za detalje.'

    ctx = {
        'title': 'CareFree',
        'recipient_name': getattr(caretaker.user, 'first_name', '') or caretaker.user.email,
        'message': message_text,
    }

    try:
        html = render_to_string('emails/caretaker_status.html', ctx)
        plain = strip_tags(html)
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None)
        send_transactional_email(
            subject=subject,
            message=plain,
            from_email=from_email,
            recipient_list=[caretaker.user.email],
            html_message=html,
            fail_silently=True,
        )
    except Exception:
        pass


class DiplomaInline(admin.TabularInline):
    model = Diploma
    extra = 0
    readonly_fields = ('file_link', 'uploaded_at')

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


class CertificateInline(admin.TabularInline):
    model = Certificate
    extra = 0
    readonly_fields = ('file_link', 'uploaded_at')

    def file_link(self, obj):
        if obj and getattr(obj, 'file', None):
            return format_html('<a href="{}" target="_blank">{}</a>', obj.file.url, obj.original_filename or 'file')
        return '-'
    file_link.short_description = 'File'


# Register your models here.
class CaretakerAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'user', 'cv_link', 'diplomas_count', 'certificates_count', 'google_calendar_connected', 'is_profile_complete', 'is_approved', 'approval_status')
    search_fields = ('user__email',)
    filter_horizontal = ('help_categories',)
    actions = ['approve_caretakers', 'deny_caretakers']
    inlines = [CaretakerCVInline, DiplomaInline, CertificateInline]

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

    def certificates_count(self, obj):
        return obj.certificates.count()
    certificates_count.short_description = 'Certificates'

    def google_calendar_connected(self, obj):
        """Check if caretaker has connected their Google Calendar"""
        from calendar_integration.models import GoogleCredential
        return GoogleCredential.objects.filter(user=obj.user).exists()
    google_calendar_connected.boolean = True
    google_calendar_connected.short_description = 'Google Calendar'

    def approve_caretakers(self, request, queryset):
        from calendar_integration.models import GoogleCredential
        updated = 0
        without_google = 0
        for ct in queryset:
            if not GoogleCredential.objects.filter(user=ct.user).exists():
                without_google += 1
                
            if getattr(ct, 'approval_status', None) != getattr(ct, 'APPROVAL_APPROVED', 'APPROVED'):
                try:
                    ct.approval_status = ct.APPROVAL_APPROVED
                except Exception:
                    pass
                ct.save()
                _send_caretaker_status_email(ct, approved=True)
                updated += 1
        
        if without_google > 0:
            self.message_user(
                request, 
                f"Approved {updated} caretakers. {without_google} approved caretakers have not connected Google Calendar yet.",
                level='warning'
            )
        else:
            self.message_user(request, f"Approved {updated} caretakers.")
    approve_caretakers.short_description = 'Approve selected caretakers and notify them'

    def deny_caretakers(self, request, queryset):
        updated = 0
        for ct in queryset:
            if getattr(ct, 'approval_status', None) != getattr(ct, 'APPROVAL_DENIED', 'DENIED'):
                try:
                    ct.approval_status = ct.APPROVAL_DENIED
                except Exception:
                    pass
                ct.save()
                _send_caretaker_status_email(ct, approved=False)
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