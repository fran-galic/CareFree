Moj dnevnik — info za fronted i deployment(ENCRYPTION_KEY)

Što aplikacija radi
- Upravljanje dnwevničkim zapisima (JournalEntry).
- Polja: title, content, mood, created_at, updated_at.
- Content se sprema enkriptirano u polje content_encrypted.

Osnovni API endpointi
- POST /api/token/ — dohvati JWT (body: email, password)
- GET /api/journal/ — listaj zapise prijavljenog korisnika
- POST /api/journal/ — kreiraj zapis, Body: title, content, mood
- GET|PATCH|DELETE /api/journal/{id}/ — dohvat/izmjena/brisanje (samo vlasnik)

Autentikacija: JWT (Authorization: Bearer <token>) ili cookie-based accessToken ako je konfigurirano.

Kako radi enkripcija
- Koristi se biblioteka cryptography.Fernet i simetrični ključ iz varijable okoline ENCRYPTION_KEY
- Pri spremanju: plaintext se enkriptira i rezultat sprema u content_encrypted
- Pri čitanju: backend dekriptira content_encrypted i vraća content kroz serializer
- U produkciji: aplikacija ne smije upisivati plain tekst u bazu ako ENCRYPTION_KEY nije postavljen

ENCRYPTION_KEY — praktične upute

1) Generiranje ključa (jednokratno)
   PowerShell (Windows):
     python - <<PY
     from cryptography.fernet import Fernet
     print(Fernet.generate_key().decode())
     PY

   bash (Linux/macOS):
     python - <<PY
     from cryptography.fernet import Fernet
     print(Fernet.generate_key().decode())
     PY

   Rezultat je dugačak Base64 string — to je ENCRYPTION_KEY. Sačuvaj ga sigurno.

2) Gdje postaviti ključ (primjeri)
   - Lokalno (razvoj):
       $env:ENCRYPTION_KEY = 'TVOJ_GENERIRANI_KLJUC'
       python backend/manage.py runserver

   - Systemd: u unit file dodaj pod [Service]: Environment="ENCRYPTION_KEY=..."
   - Docker Compose: postavi ENCRYPTION_KEY kao environment var (ili koristite Docker secrets)
   - Heroku: heroku config:set ENCRYPTION_KEY='...' -a your-app
   - Kubernetes: kreirajte Secret i mapirajte ga u env var u Deploymentu

3) Provjera dostupnosti ključa u procesu
   python -c "import os; print('ENCRYPTION_KEY' in os.environ)"

Operativne smjernice za deployment i nadogradnje

- Postavi isti ENCRYPTION_KEY na sve instance prije nego što bilo koja instanca počne raditi s enkriptiranim podacima
- Ako radite rolling update: postavite ključ na svim novim i postojećim instancama prije prebacivanja prometa
- Ako migracija stvara ili ažurira zapise koji se enkriptiraju pri spremanju, osiguraj da ENCRYPTION_KEY bude dostupan prije pokretanja migracija
- Backup ključa: držite ključ u sigurnom vaultu (npr. HashiCorp Vault, AWS Secrets Manager, Azure Key Vault). Napravite backup i dokumentirajte tko može pristupiti

Rotacija ključa (osnovni pristup)

Opcija A — planirana rotacija sa downtime-om (jednostavnije i sigurnije):
  1) Backup baze i ključa
  2) Na jednom kontroliranom okruženju dekriptirajte sve zapise starim ključem i ponovno ih enkriptirajte novim ključem
  3) Zamijenite ENCRYPTION_KEY u vaultu i na serverima, restartajte servise

Opcija B — rotacija bez velikog downtime-a (složenije):
  1) Ažurirajte aplikaciju da podržava dva ključa: primary (novi) i secondary (stari)
  2) Pri čitanju: pokušaj dekriptirati primary; ako ne uspije, pokušaj secondary
  3) Pri pisanju: uvijek enkriptiraj s primary
  4) Nakon što su svi zapisi re-enkriptirani primary ključem, uklonite secondary

Napomena: rotacija zahtijeva dobru proceduru za backup i testiranje. Ne pokušavajte rotaciju bez testa.

Sigurnost i preporuke
- Nikada ne pohranjujte ENCRYPTION_KEY u Git
- Ograničite pristup ključu i dokumentirajte tko ga može dohvatiti
- Pohranite ključ u tajnom manageru, a ne u plaintext konfiguracijskim datotekama koje su dostupne široko
- Ako ključ bude kompromitiran — tretirajte incident ozbiljno: otkrijte koji su podaci izloženi i planirajte rotaciju

Export podataka
- Management naredba export_journal izvozi enkriptirane blobove po defaultu. Dekripcija pri izvozu zahtijeva pristup ENCRYPTION_KEY


Pokretanje lokalno — kratko
- Postavite virtualno okruženje i instalirajte ovisnosti:
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1
    python -m pip install -r backend/requirements.txt
    python -m pip install cryptography



Dodatne informacije i pojašnjenja za frontend

- Autentikacija
  - Ako koristite JWT, na svaki zahtjev dodajte header Authorization: Bearer <token>.
  - Ako koristite cookie-based auth, pošaljite zahtjeve s credentials: 'include' i osigurajte da su cookie postavke (SameSite, Secure) kompatibilne s okolinom.

- Oblici (payload) i odgovori
  - List (GET /api/journal/): preporučeno je da backend vraća paginiranu listu u obliku koji uključuje count, next, previous i results (DRF-style). Svaki element u results treba sadržavati barem: id, title, mood, created_at, te snippet (kratki preview) ili ograničeni content
  - Create (POST /api/journal/): pošaljite JSON { title, content, mood }. Backend vraća status 201 i objekt s poljima novog resursa (uključujući id)
  - Detail (GET /api/journal/{id}/): vraća puni, dekriptirani content i metapodatke (id, title, mood, created_at, updated_at)
  - Update (PATCH /api/journal/{id}/): šalje samo polja koja se mijenjaju. Preporučeno je vratiti ažurirani objekt
  - Delete (DELETE /api/journal/{id}/): vraća 204 No Content na uspjeh

- Preporučeni UI patterni
  - Lista: prikazati snippet za svaki zapis; učitaj puni content tek na zahtjev (klik na stavku)
  - Kreiranje/uređivanje: validacija na klijentu i prikaz server-side grešaka (400) pored odgovarajućih polja
  - Brisanje: zahtijevati potvrdu (modal) prije slanja DELETE zahtjeva

- Pagination i search
  - Ako očekujete puno zapisa, frontend će radije koristiti paginaciju (ne dohvaćati sve odjednom). Provjerite ima li backend uključen DRF pagination.
  - Za pretragu tekstom ili filtriranje po mood/datum, koristite query parametre npr. ?q=rijec&mood=happy&page=2 i provjerite podršku na backendu.

- Error handling i autentikacija
  - Ako backend vrati 401/403, frontend treba preusmjeriti korisnika na ekran za prijavu
  - Za validation errors (400) očekujte objekt s poljima – prikažite poruke pored polja


  - Ako frontend radi s drugog origin-a, backend mora dopustiti CORS za taj origin i dozvoliti slanje cookie-a (Access-Control-Allow-Credentials: true). U fetch pozivima koristite credentials: 'include'

- Primjeri (JavaScript)
  - Dohvat liste s JWT:
    fetch('/api/journal/', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(r => r.json()).then(data => /* render data.results */)

  - Kreiranje s cookie-based auth:
    fetch('/api/journal/', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, mood })
    })

  - Dohvat pojedinog zapisa:
    fetch(`/api/journal/${id}/`, { headers: { 'Authorization': 'Bearer ' + token } })
      .then(r => r.json())

- Dodatne napomene za frontend
  - Prikažite jasne loading stateove i poruke o greškama (network/server)
  - Ako planirate concurrent edit (više uređivača), koristite updated_at za optimistic locking i prikažite konflikt (put/patch vraća 409 ili custom kod)
  - Ne očekujte export dekriptiranih podataka u UI bez dodatne autorizacije
