CALENDAR INTEGRATION

Aplikacija služi za serversku (backend) integraciju s Google Calendarom pomoću Google Service Accounta. Cilj aplikacije je sinkronizirati događaje iz Google Calendara u lokalnu bazu podataka te omogućiti kreiranje novih događaja u Google Calendaru iz aplikacije.

Aplikacija je zamišljena kao osnovna na koju se kasnije može proširivati (povezivanje s terminima, periodička sinkronizacija...).


GLAVNE FUNKCIONALNOSTI

1) Modeli Calendar i CalendarEvent  
U bazi se čuvaju kalendar i njihovi događaji. Svaki događaj ima Google event ID, osnovne informacije (naslov, opis, početak, kraj), opcionalni Google Meet link te raw podatke koje vraća Google API.

2) Management command sync_google_calendar  
Postoji poseban Django command koji:
- dohvaća događaje iz Google Calendara
- sprema ih u lokalnu bazu
- ažurira postojeće zapise ako već postoje
- radi u "dry-run" modu ako credentials nisu postavljeni (stvara simulirani događaj)

Ovaj command je centralno mjesto za sinkronizaciju i koristi se i ručno i iz pozadine.

3) API endpointi (samo za admin korisnike)
- endpoint za dohvat posljednjih događaja iz baze
- endpoint za ručno pokretanje sinkronizacije
- endpoint za kreiranje novog Google Calendar događaja (uz opcionalni Google Meet link)

4) Celery task
Postoji Celery task koji samo poziva management command za sinkronizaciju. Time se omogućuje:
- pozadinsko izvođenje
- retry mehanizam
- kasnije jednostavno zakazivanje periodične sinkronizacije



SINKRONIZACIJA
- aplikacija se autentificira prema Google Calendar API-ju pomoću Service Accounta
- dohvaćaju se događaji u određenom vremenskom rasponu (nedavni i nadolazeći)
- svaki događaj se sprema ili ažurira u lokalnoj bazi
- Google event ID se koristi kao jedinstveni ključ
- ako događaj sadrži Google Meet link, on se izdvaja i sprema

Ako credentials nisu dostupni, aplikacija ne puca, nego se pokreće u razvojnom (dry-run) načinu rada.


KREIRANJE DOGAĐAJA PUTEM API-JA

Aplikacija ima admin-only endpoint za kreiranje Google Calendar evenata.

Tijek:
- backend primi podatke (naslov, opis, vrijeme početka i kraja, sudionike)
- poziva Google Calendar API
- po potrebi zatraži Google Meet link
- nakon uspješnog kreiranja događaja, isti se sprema i u lokalnu bazu

Na taj način lokalna baza i Google Calendar ostaju sinkronizirani.


KONFIGURACIJA I ENV VARIJABLE

Za rad aplikacije potrebno je postaviti sljedeće varijable okruženja:

- GOOGLE_SERVICE_ACCOUNT_FILE  
  Putanja do JSON datoteke sa Service Account credentialsima (preporučeno za produkciju)

ILI

- GOOGLE_SERVICE_ACCOUNT_JSON  
  Base64 enkodirani sadržaj JSON credentialsa (korisno za CI i secret managere)

- GOOGLE_CALENDAR_ID  
  ID ili email Google kalendara s kojim se radi (npr. group.calendar.google.com)

- CELERY_BROKER_URL  
  URL brokera za Celery (lokalno se najčešće koristi Redis)


SIGURNOSNE NAPOMENE
- Service Account JSON se nikada ne smije commitati u Git
- Credentials treba držati u sigurnoj lokaciji ili secret manageru
- Google Calendar treba podijeliti sa service account email adresom i dati prava za izmjenu događaja
- Koristi se minimalni potrebni scope za Google Calendar API



Vjerojatne buduće nadogradnje koje se moraju napraviti:
- dodati periodičku sinkronizaciju (Celery Beat)
- dodati retry i rate-limit handling
- dodati testove za sync i create flow
- implementirati Google Calendar push notifikacije (webhook)