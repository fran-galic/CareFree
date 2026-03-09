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
        from django.utils.html import strip_tags
        from django.conf import settings
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from backend.emailing import send_project_email

        if mail_type == 'confirm_registration':
            registration_link = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3001').rstrip('/')}" + "/accounts/signup?token=TESTTOKEN"
            ctx = {'registration_link': registration_link}
            html = render_to_string('emails/confirm_registration.html', ctx)
            subject = 'Dovršite registraciju na CareFree'

        elif mail_type == 'password_reset':
            uid = urlsafe_base64_encode(force_bytes('test-user'))
            token = 'TEST-RESET-TOKEN'
            reset_link = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3001').rstrip('/')}" + f"/auth/reset-password/{uid}/{token}/"
            ctx = {'user_first_name': name, 'reset_link': reset_link}
            html = render_to_string('emails/password_reset.html', ctx)
            subject = 'Resetiraj svoju lozinku - CareFree'

        elif mail_type == 'caretaker_approval':
            subject = 'CareFree - account approved'
            message_text = 'Vaš račun njegovatelja je odobren. Sada možete koristiti aplikaciju.'
            action_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3001').rstrip('/')}" + '/auth/login'
            ctx = {
                'title': 'CareFree',
                'recipient_name': name,
                'message': message_text,
                'action_url': action_url,
            }
            html = render_to_string('emails/caretaker_status.html', ctx)

        else:  # caretaker_denial
            subject = 'CareFree - account denied'
            message_text = 'Vaš račun njegovatelja je odbijen. Obratite se administratoru za detalje.'
            ctx = {
                'title': 'CareFree',
                'recipient_name': name,
                'message': message_text,
                'action_url': None,
            }
            html = render_to_string('emails/caretaker_status.html', ctx)

        plain = strip_tags(html)

        self.stdout.write('Sending test email...')
        try:
            send_project_email(subject=subject, message=plain, recipient_list=[to_email], html_message=html, fail_silently=False)
            self.stdout.write(self.style.SUCCESS(f'Email sent successfully to {to_email}'))
        except Exception as e:
            raise CommandError(f'Failed to send email: {e}')
