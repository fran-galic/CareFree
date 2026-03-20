from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0017_caretaker_show_email_to_students_and_more'),
        ('appointments', '0003_reservationhold'),
    ]

    operations = [
        migrations.CreateModel(
            name='AppointmentFeedback',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('submitted', 'Submitted'), ('dismissed', 'Dismissed')], default='submitted', max_length=20)),
                ('selected_response', models.CharField(blank=True, choices=[('calmer', 'Osjećam se mirnije'), ('helped', 'Razgovor mi je pomogao'), ('clearer', 'Dobio/la sam više jasnoće'), ('processing', 'Još razmišljam o svemu')], max_length=30, null=True)),
                ('comment', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('appointment', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='feedback', to='appointments.appointment')),
                ('caretaker', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='appointment_feedback', to='accounts.caretaker')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='appointment_feedback', to='accounts.student')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='appointmentfeedback',
            index=models.Index(fields=['caretaker', 'status'], name='appointmen_caretak_b164c0_idx'),
        ),
        migrations.AddIndex(
            model_name='appointmentfeedback',
            index=models.Index(fields=['student', 'status'], name='appointmen_student_3c1772_idx'),
        ),
    ]
