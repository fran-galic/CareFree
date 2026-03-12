from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Send a test email using project email settings (confirm_registration, password_reset, caretaker_approval, caretaker_denial)'

    def add_arguments(self, parser):
        parser.add_argument('--to', required=True, help='Recipient email')
        parser.add_argument('--type', choices=['confirm_registration', 'password_reset', 'caretaker_approval', 'caretaker_denial'], default='confirm_registration')
        parser.add_argument('--name', default='User', help='Recipient first name used in template')

    def handle(self, *args, **options):
        to_email = options['to']
        mail_type = options['type']
        name = options.get('name') or 'User'

        from django.template.loader import render_to_string
        from django.conf import settings
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from django.utils.html import strip_tags
        from backend.emailing import get_email_asset_urls, render_branded_email, send_project_email

        if mail_type == 'confirm_registration':
            registration_link = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3001').rstrip('/')}" + "/accounts/signup?token=TESTTOKEN"
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3001').rstrip('/')
            ctx = {
                'registration_link': registration_link,
                **get_email_asset_urls(),
            }
            html = render_to_string('emails/confirm_registration.html', ctx)
            subject = 'Dovršite registraciju na CareFree'

        elif mail_type == 'password_reset':
            uid = urlsafe_base64_encode(force_bytes('test-user'))
            token = 'TEST-RESET-TOKEN'
            reset_link = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3001').rstrip('/')}" + f"/auth/reset-password/{uid}/{token}/"
            html, plain = render_branded_email(
                title='Resetiraj svoju lozinku',
                intro='Zaprimili smo zahtjev za promjenu lozinke za tvoj CareFree račun.',
                body_lines=[
                    'Ako si ti zatražio/la promjenu, otvori donji link i postavi novu lozinku.',
                    'Ako nisi tražio/la reset lozinke, možeš ignorirati ovu poruku.',
                ],
                action_label='Resetiraj lozinku',
                action_url=reset_link,
                recipient_name=name,
            )
            subject = 'Resetiraj svoju lozinku - CareFree'
            self.stdout.write('Sending test email...')
            try:
                send_project_email(subject=subject, message=plain, recipient_list=[to_email], html_message=html, fail_silently=False)
                self.stdout.write(self.style.SUCCESS(f'Email sent successfully to {to_email}'))
                return
            except Exception as e:
                raise CommandError(f'Failed to send email: {e}')

        elif mail_type == 'caretaker_approval':
            subject = 'CareFree - account approved'
            message_text = 'Vaš račun njegovatelja je odobren. Sada možete koristiti aplikaciju.'
            ctx = {
                'title': 'CareFree',
                'recipient_name': name,
                'message': message_text,
                **get_email_asset_urls(),
            }
            html = render_to_string('emails/caretaker_status.html', ctx)

        else:  # caretaker_denial
            subject = 'CareFree - account denied'
            message_text = 'Vaš račun njegovatelja je odbijen. Obratite se administratoru za detalje.'
            ctx = {
                'title': 'CareFree',
                'recipient_name': name,
                'message': message_text,
                **get_email_asset_urls(),
            }
            html = render_to_string('emails/caretaker_status.html', ctx)

        plain = strip_tags(html)

        self.stdout.write('Sending test email...')
        try:
            send_project_email(subject=subject, message=plain, recipient_list=[to_email], html_message=html, fail_silently=False)
            self.stdout.write(self.style.SUCCESS(f'Email sent successfully to {to_email}'))
        except Exception as e:
            raise CommandError(f'Failed to send email: {e}')
