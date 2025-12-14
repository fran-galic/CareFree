from rest_framework import serializers
from .models import JournalEntry


class JournalEntrySerializer(serializers.ModelSerializer):
    content = serializers.CharField(allow_blank=True, allow_null=True, required=False)

    # metapodaci serijalizatora
    class Meta:
        model = JournalEntry
        fields = [
            'id', 'student', 'title', 'content', 'mood', 'analysis_summary', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'student', 'analysis_summary', 'created_at', 'updated_at']

    # kod kreiranja unosa serializer šalje sadržaj modelu koji ga kriptira
    def create(self, validated_data):
        content = validated_data.pop('content', None)
        from .models import JournalEntry
        entry = JournalEntry(**validated_data)
        if content is not None:
            entry.content = content
        entry.save()
        return entry

    # kod ažuriranja unosa serializer šalje sadržaj modelu koji ga kriptira
    def update(self, instance, validated_data):
        content = validated_data.pop('content', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if content is not None:
            instance.content = content
        instance.save()
        return instance
