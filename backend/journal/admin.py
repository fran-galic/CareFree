from django.contrib import admin
from .models import JournalEntry

# definiramo kako će dnevnički unosi izgledati u admin sučelju
@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    # nema prikazivanja sadržaja (content)
    list_display = ('id', 'student', 'title', 'created_at')

    # napomena: originalno je postojao 'tags' u search_fields; polje je uklonjeno,
    # zato koristimo samo sigurna polja za pretragu
    search_fields = ('title', 'student__username', 'student__email')
    readonly_fields = ('created_at', 'updated_at')
    exclude = ('content_encrypted',)

    # onemogućavamo bilo kakve izmjene unosa iz admin sučelja
    def has_view_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
