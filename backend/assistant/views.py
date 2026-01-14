from django.utils import timezone

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.http import StreamingHttpResponse
from accounts.models import Caretaker, HelpCategory
import json

from .models import AssistantSession, AssistantMessage, AssistantSessionSummary
from .serializers import (
    AssistantSessionSerializer,
    AssistantMessageSerializer,
    AssistantSessionSummarySerializer,
    ChatMessageRequestSerializer,
)
from users.serializers import CaretakerLongSerializer

from openai import OpenAI




def _get_student_from_request(request):
    user = request.user
    student = getattr(user, "student", None)
    return student


def generate_stream(session: AssistantSession):
    """Placeholder bot reply logic.
    TODO: Zamijeniti pravom AI logikom.
    """

    try:
        messages = session.messages.order_by("sequence")


    except Exception as e:
        return Response({"error": "Neuspješno dohvaćanje poruka iz sesije."}, status=status.HTTP_400_BAD_REQUEST)
    
    full_response=""
    bot_message = AssistantMessage.objects.create(
            session=session,
            sender=AssistantMessage.SENDER_BOT,
            content=full_response,
        )

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    prompt = f"""
        Ti si AI podrška za mentalno zdravlje namijenjena studentima.  
        Tvoja uloga NIJE postavljanje dijagnoza niti zamjena za psihoterapiju.  
        Ti si emocionalna prva pomoć - nježan, siguran i podržavajući sugovornik.

        ------------------------------------------------------------
        TVOJE GLAVNE ZADAĆE
        ------------------------------------------------------------
        1. Pružati toplo, empatično, smirujuće okruženje.
        2. Aktivno slušati i potvrđivati osjećaje korisnika.
        3. Nuditi blage, sigurne tehnike suočavanja (disanje, grounding, refleksija).
        4. Nikad ne koristiti medicinske ili dijagnostičke izraze.
        5. Voditi razgovor nenametljivo i nježno.
        6. Kad prikupiš dovoljno informacija, pitaj:
        “Želiš li da ti sažmem što si mi rekao/la i preporučim psihologe koji se bave ovakvim temama?”
        7. Ako korisnik kaže DA — napravi sažetak i kategorizaciju prema tablici kategorija.
        8. U kriznim situacijama prebacuješ se u *CRISIS MODE*.

        ------------------------------------------------------------
        TON KOMUNIKACIJE
        ------------------------------------------------------------
        Uvijek: topao, smiren, empatičan, neosuđujući, nježan.  
        Nikad: zapovijedi, dijagnoze, obećanja da će sve biti dobro.

        ------------------------------------------------------------
        KATEGORIZACIJA PROBLEMA
        ------------------------------------------------------------
        Ako korisnik želi preporuku psihologa, odredi kategoriju i podkategorije.

        GLAVNE KATEGORIJE I NJIHOVE PODKATEGORIJE:

        1. Stres i akademski pritisci

        - strah od ispita i loših ocjena
        - preopterećenost obavezama
        - problemi s organizacijom vremena i prokrastinacija

        2. Anksiozni poremećaji

        - Generalizirani anksiozni poremećaj
        - Socijalna anksioznost (strah od javnog nastupa, kontakta s profesorima/vršnjacima)
        - Panični napadi

        3. Depresivni simptomi

        - Tuga, gubitak interesa za aktivnosti
        - Umor i demotivacija
        - Nisko samopouzdanje i osjećaj bespomoćnosti

        4. Problemi u međuljudskim odnosima

        - Sukobi s kolegama, prijateljima ili partnerima
        - Problemi s komunikacijom i asertivnošću
        - Osjećaj izolacije i usamljenosti

        5. Poremećaji spavanja

        - Nesanicu ili nepravilne navike spavanja
        - Posljedice kroničnog umora na koncentraciju i raspoloženje

        6. Problemi samopouzdanja i identiteta

        - Sumnja u vlastite sposobnosti
        - Nesigurnost u odabir studija ili karijere
        - Osobni razvoj i pronalazak smisla

        7. Poremećaji prehrane i tjelesne slike

        - Anoreksija
        - Bulimija
        - Prejedanje
        - Negativna tjelesna slika i poremećena percepcija sebe

        8. Emocionalna regulacija i impulzivno ponašanje

        - Nagli ispadi bijesa ili frustracije
        - Problemi s kontrolom impulsa
        - Ovisničko ponašanje (društvene mreže, kockanje, alkohol)

        9. Trauma i stresne životne situacije

        - Gubitak bliske osobe
        - Obiteljski problemi ili zlostavljanje
        - Adaptacija na novi životni period (selidba, fakultet u drugom gradu)

        10. Seksualnost 

        - propitivanje vlastite seksualnosti
        - anksioznost vezana za stupanje u spolne odnose

        11. KRIZNE SITUACIJE (RIZIK)

        - Suicidalne misli
        - Planovi samoozljeđivanja
        - Samoozljeđivanje
        - Namjera naštetiti drugima
        - Teška disocijacija
        - Psihotična iskustva

        12. OSTALO:
        Kategorija bez podkategorija. Za ovu kategoriju potrebno je vratiti praznu listu podkategorija.
        Ova kategorija se koristi u slučajevima kada se problem ne može svrstati ni u jednu drugu postojeću kategoriju.

        ------------------------------------------------------------
        KRIZNI MODE — KADA SE AKTIVIRA
        ------------------------------------------------------------
        Ako korisnik govori o:
        - suicidalnim mislima,
        - planovima ili namjeri samoozljeđivanja,
        - ozbiljnom riziku,
        - namjeri da ugrozi druge,
        - izrazito dezorijentiranom ili psihotičnom stanju,

        → odmah aktiviraj CRISIS MODE.

        U kriznom odgovoru:
        1. Ostani maksimalno nježan i smirujući.
        2. Validiraj njihove osjećaje.
        3. NE obećavaj da će sve biti dobro.
        4. Uputi ih da odmah kontaktiraju stručne službe.
        5. OBAVEZNO uključi hitne brojeve:

        - Plavi telefon: 01 4833 888 — https://plavitelefon.hr
        - Centar za krizna stanja i prevenciju suicida: 01 2376 335
        - Hrabri telefon: 116 111
        - Hitna pomoć: 112


        ------------------------------------------------------------
        ZAVRŠNA UPUTA
        ------------------------------------------------------------
        - NIKADA ne dijagnosticiraj  
        - NE obećavaj rješenja  
        - UVIJEK ostani empatičan i podržavajući  

    """

    messages_for_openai = [
        {
            "role": "system",
            "content": prompt,
        }
    ]

    for msg in messages:
                role = "user" if msg.sender == AssistantMessage.SENDER_STUDENT else "assistant"
                messages_for_openai.append({
                    "role": role,
                    "content": msg.content,
                })

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages_for_openai,
        temperature=0.7,
    )


    text = (completion.choices[0].message.content or "").strip()
    bot_message.content = text
    bot_message.save()
    return bot_message
    # stream = client.chat.completions.create(
    #             model="gpt-4o-mini",
    #             messages=messages_for_openai,
    #             #stream=True,
    #             temperature=0.7,
    #         )
    
    # try:
    #     for chunk in stream:
    #         if chunk.choices[0].delta.content is not None:
    #             content_chunk = chunk.choices[0].delta.content
    #             full_response += content_chunk
    #             chunk_data = {
    #                 "content": content_chunk,
    #                 "finished": False,
    #                 "message_id": bot_message.id,
    #             }
    #             yield f"data: {json.dumps(chunk_data)}\n\n"


                
    #     bot_message.content = full_response.strip()
    #     bot_message.save(update_fields=['content'])

    #     final_data = {
    #         "content": "",
    #         "finished": True,
    #         "full_reply": full_response,
    #     }
    #     yield f"data: {json.dumps(final_data)}\n\n"


    #         #TODO: Implementirati kod za dohvacanje psihologa i njihov prikaz korisniku

    #     #elif parsed.get("mode", "").lower() == "crisis" and parsed.get("danger_flag"):
    
    # except Exception as e:
    #     error_data = {
    #         "content": f"Došlo je do greške: {str(e)}",
    #         "finished": True,
    #         "message_id": bot_message.id,
    #     }
    #     yield f"data: {json.dumps(error_data)}\n\n"


        #return Response({"message": resp}, stauts=status.HTTP_200_OK)




def generate_session_summary(session: AssistantSession) -> str:
    """Generate a simple textual summary of a session.

    TODO: Zamijeniti pravom AI sumarizacijom.
    """
    messages = session.messages.order_by("sequence")
    total = messages.count()
    if total == 0:
        return "Sesija nema poruka."
    

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    prompt = f"""
        Ti si psihološki asistent za studente koji ti se javljaju s problemima. Šaljem ti sve poruke koje su do sada protekle
        u ovom razgovoru sa studentom. Tvoja uloga je procijeniti jesi li prikupio dovoljno informacija od studenta da znaš o 
        kakvom se problemu radi (da ga možeš svrstati u jednu od kategorija). Imaš pristup svim porukama koje su poslane tijekom 
        ovog razgovora kao i kategorizaciju svih mogućih kategorija:

        ------------------------------------------------------------
        KATEGORIZACIJA PROBLEMA
        ------------------------------------------------------------
        Ako korisnik želi preporuku psihologa, odredi kategoriju i podkategorije.

        GLAVNE KATEGORIJE I NJIHOVE PODKATEGORIJE:

        1. Stres i akademski pritisci

        - strah od ispita i loših ocjena
        - preopterećenost obavezama
        - problemi s organizacijom vremena i prokrastinacija

        2. Anksiozni poremećaji

        - Generalizirani anksiozni poremećaj
        - Socijalna anksioznost (strah od javnog nastupa, kontakta s profesorima/vršnjacima)
        - Panični napadi

        3. Depresivni simptomi

        - Tuga, gubitak interesa za aktivnosti
        - Umor i demotivacija
        - Nisko samopouzdanje i osjećaj bespomoćnosti

        4. Problemi u međuljudskim odnosima

        - Sukobi s kolegama, prijateljima ili partnerima
        - Problemi s komunikacijom i asertivnošću
        - Osjećaj izolacije i usamljenosti

        5. Poremećaji spavanja

        - Nesanicu ili nepravilne navike spavanja
        - Posljedice kroničnog umora na koncentraciju i raspoloženje

        6. Problemi samopouzdanja i identiteta

        - Sumnja u vlastite sposobnosti
        - Nesigurnost u odabir studija ili karijere
        - Osobni razvoj i pronalazak smisla

        7. Poremećaji prehrane i tjelesne slike

        - Anoreksija
        - Bulimija
        - Prejedanje
        - Negativna tjelesna slika i poremećena percepcija sebe

        8. Emocionalna regulacija i impulzivno ponašanje

        - Nagli ispadi bijesa ili frustracije
        - Problemi s kontrolom impulsa
        - Ovisničko ponašanje (društvene mreže, kockanje, alkohol)

        9. Trauma i stresne životne situacije

        - Gubitak bliske osobe
        - Obiteljski problemi ili zlostavljanje
        - Adaptacija na novi životni period (selidba, fakultet u drugom gradu)

        10. Seksualnost 

        - propitivanje vlastite seksualnosti
        - anksioznost vezana za stupanje u spolne odnose

        11. KRIZNE SITUACIJE (RIZIK)

        - Suicidalne misli
        - Planovi samoozljeđivanja
        - Samoozljeđivanje
        - Namjera naštetiti drugima
        - Teška disocijacija
        - Psihotična iskustva

        12. OSTALO:
        Kategorija bez podkategorija. Za ovu kategoriju potrebno je vratiti praznu listu podkategorija.
        Ova kategorija se koristi u slučajevima kada se problem ne može svrstati ni u jednu drugu postojeću kategoriju.

        ------------------------------------------------------------
        KRIZNI MODE — KADA SE AKTIVIRA
        ------------------------------------------------------------
        Ako korisnik govori o:
        - suicidalnim mislima,
        - planovima ili namjeri samoozljeđivanja,
        - ozbiljnom riziku,
        - namjeri da ugrozi druge,
        - izrazito dezorijentiranom ili psihotičnom stanju,

        → odmah aktiviraj CRISIS MODE.

        U kriznom odgovoru:
        1. Ostani maksimalno nježan i smirujući.
        2. Validiraj njihove osjećaje.
        3. NE obećavaj da će sve biti dobro.
        4. Puno ranije primijeti i generiraj summary jer nakon generiranje summaryja dolazi do kontaktiranja službene pomoći


        =====OBAVEZNO=====
        VRATI ISKLJUČIVO VALIDAN JSON BEZ IKAKVOG TEKSTA
         {{
            "mode": "recommendation",
            "summary": "<anonimni sažetak problema>",
            "main_category": "<glavna kategorija>",
            "subcategories": ["<podkategorija1>", "<podkategorija2>"],
            "danger_flag": false,
            "recommendation_ready": true
        }}

        mode -> određuje u kojem smo dijelu razgovora (je li kritični problem => "crisis", 
        jesi li prikupio dovoljno informacija => "recommendation",
        ako nemaš još dovoljno informacija => "converstaion")

        summary -> pišeš isključivo kada si prikupio dovoljno informacija, inače ga ostavi praznim
        main_category i subcategories -> tu napiši kategorije koje si prepoznao unutar kategorija koje si dobio
        danger_flag -> true ako smo u kriznom modu, inače false
        recommendation_ready -> true ako si prikupio dovoljno informacija i spreman si napraviti kvalitetan summary razgovora
                                u kojem govoriš o problemima s kojima se student susreće, inače false

        summary i recommendation_ready dolaze u paru => ako je recommendation_ready true, onda moraš i izgenerirati summary razgovora
        inače ako je recommendation_ready false, summary je prazan.

        TVOJ CILJ JE OTKRITI KOJI SU PROBLEMI STUDENTA. TVOJ SUMMARY MORA BITI DOVOLJNO DETALJAN I BAZIRAN NA PORUKAMA KOJE TI JE
        STUDENT POSLAO. NAJBOLJE BI TI BILO IMATI KRATAK RAZGOVOR S NJIME (OTPRILIKE 10 NJEGOVIH PORUKA) IZ KOJEG ĆEŠ IZVUĆI SVE
        PROBLEME O KOJIMA TI STUDENT PRIĆA. AKO TI STUDENT ZADA JEDAN PROBLEM; TO NE MORA BITI JEDINI. PROBAJ KROZ RAZGOVOR 
        SKUŽITI O KOLIKO I KAKVIM PROBLEMIMA SE RADI, NEMOJ BRZATI (PRERANO ZAKLJUČITI O ČEMU TI SE STUDENT ŽALI)
        

    """

    messages_for_openai = [
        {
            "role": "system",
            "content": prompt,
        }
    ]

    for msg in messages:
                role = "user" if msg.sender == AssistantMessage.SENDER_STUDENT else "assistant"
                messages_for_openai.append({
                    "role": role,
                    "content": msg.content,
                })

    text = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages_for_openai,
                temperature=0.7,
                response_format={"type": "json_object"},
            ).choices[0].message.content
    
    #summary = summary.choices[0].message.content
    parsed = json.loads(text)
    if parsed.get("recommendation_ready", ""):
        summary = parsed.get("summary", "")
        if not summary.strip():
            print("Error, summary nije izgeneriran")
            return
        
        AssistantSessionSummary.objects.create(
            student=session.student,
            session=session,
            content=summary,
        )
        session.is_active = False
        session.ended_at = timezone.now()
        session.save(update_fields=["is_active", "ended_at", "updated_at"])

        first = messages.first().content[:100]
        last = messages.last().content[:100]
        return f"Sesija ima {total} poruka. Prva poruka: '{first}'. Zadnja poruka: '{last}'."
    else:
        return f"Došlo je do greške pri parsiranju json-a."



def generate_bot_message(session: AssistantSession) -> json:
    """Generate a simple textual summary of a session.

    TODO: Zamijeniti pravom AI sumarizacijom.
    """
    messages = session.messages.order_by("sequence")
    total = messages.count()
    if total == 0:
        return "Sesija nema poruka."
    

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    prompt = f"""
        Ti si psihološki asistent za studente koji ti se javljaju s problemima. Šaljem ti sve poruke koje su do sada protekle
        u ovom razgovoru sa studentom. Tvoja uloga je procijeniti jesi li prikupio dovoljno informacija od studenta da znaš o 
        kakvom se problemu radi (da ga možeš svrstati u jednu od kategorija). Imaš pristup svim porukama koje su poslane tijekom 
        ovog razgovora kao i kategorizaciju svih mogućih kategorija:

        ------------------------------------------------------------
        KATEGORIZACIJA PROBLEMA
        ------------------------------------------------------------
        Ako korisnik želi preporuku psihologa, odredi kategoriju i podkategorije.

        GLAVNE KATEGORIJE I NJIHOVE PODKATEGORIJE:

        1. Stres i akademski pritisci

        - strah od ispita i loših ocjena
        - preopterećenost obavezama
        - problemi s organizacijom vremena i prokrastinacija

        2. Anksiozni poremećaji

        - Generalizirani anksiozni poremećaj
        - Socijalna anksioznost (strah od javnog nastupa, kontakta s profesorima/vršnjacima)
        - Panični napadi

        3. Depresivni simptomi

        - Tuga, gubitak interesa za aktivnosti
        - Umor i demotivacija
        - Nisko samopouzdanje i osjećaj bespomoćnosti

        4. Problemi u međuljudskim odnosima

        - Sukobi s kolegama, prijateljima ili partnerima
        - Problemi s komunikacijom i asertivnošću
        - Osjećaj izolacije i usamljenosti

        5. Poremećaji spavanja

        - Nesanicu ili nepravilne navike spavanja
        - Posljedice kroničnog umora na koncentraciju i raspoloženje

        6. Problemi samopouzdanja i identiteta

        - Sumnja u vlastite sposobnosti
        - Nesigurnost u odabir studija ili karijere
        - Osobni razvoj i pronalazak smisla

        7. Poremećaji prehrane i tjelesne slike

        - Anoreksija
        - Bulimija
        - Prejedanje
        - Negativna tjelesna slika i poremećena percepcija sebe

        8. Emocionalna regulacija i impulzivno ponašanje

        - Nagli ispadi bijesa ili frustracije
        - Problemi s kontrolom impulsa
        - Ovisničko ponašanje (društvene mreže, kockanje, alkohol)

        9. Trauma i stresne životne situacije

        - Gubitak bliske osobe
        - Obiteljski problemi ili zlostavljanje
        - Adaptacija na novi životni period (selidba, fakultet u drugom gradu)

        10. Seksualnost 

        - propitivanje vlastite seksualnosti
        - anksioznost vezana za stupanje u spolne odnose

        11. KRIZNE SITUACIJE (RIZIK)

        - Suicidalne misli
        - Planovi samoozljeđivanja
        - Samoozljeđivanje
        - Namjera naštetiti drugima
        - Teška disocijacija
        - Psihotična iskustva

        12. OSTALO:
        Kategorija bez podkategorija. Za ovu kategoriju potrebno je vratiti praznu listu podkategorija.
        Ova kategorija se koristi u slučajevima kada se problem ne može svrstati ni u jednu drugu postojeću kategoriju.

        ------------------------------------------------------------
        KRIZNI MODE — KADA SE AKTIVIRA
        ------------------------------------------------------------
        Ako korisnik govori o:
        - suicidalnim mislima,
        - planovima ili namjeri samoozljeđivanja,
        - ozbiljnom riziku,
        - namjeri da ugrozi druge,
        - izrazito dezorijentiranom ili psihotičnom stanju,

        → odmah aktiviraj CRISIS MODE.

        U kriznom odgovoru:
        1. Ostani maksimalno nježan i smirujući.
        2. Validiraj njihove osjećaje.
        3. NE obećavaj da će sve biti dobro.
        4. Puno ranije primijeti i generiraj summary jer nakon generiranje summaryja dolazi do kontaktiranja službene pomoći


        =====OBAVEZNO=====
        VRATI ISKLJUČIVO VALIDAN JSON BEZ IKAKVOG TEKSTA
         {{
            "mode": "recommendation",
            "message": "<tvoja poruka korisniku>",
            "summary": "<anonimni sažetak problema>",
            "main_category": "<glavna kategorija>",
            "subcategories": ["<podkategorija1>", "<podkategorija2>"],
            "danger_flag": false,
            "recommendation_ready": true
        }}

        mode -> određuje u kojem smo dijelu razgovora (je li kritični problem => "crisis", 
        jesi li prikupio dovoljno informacija => "recommendation",
        ako nemaš još dovoljno informacija => "converstaion")

        message -> poruka koju vraćaš nazad korisniku 
        summary -> pišeš isključivo kada si prikupio dovoljno informacija, inače ga ostavi praznim
        main_category i subcategories -> tu napiši kategorije koje si prepoznao unutar kategorija koje si dobio
        danger_flag -> true ako smo u kriznom modu, inače false
        recommendation_ready -> true ako si prikupio dovoljno informacija i spreman si napraviti kvalitetan summary razgovora
                                u kojem govoriš o problemima s kojima se student susreće, inače false

        summary i recommendation_ready dolaze u paru => ako je recommendation_ready true, onda moraš i izgenerirati summary razgovora
        inače ako je recommendation_ready false, summary je prazan.

        TVOJ CILJ JE OTKRITI KOJI SU PROBLEMI STUDENTA. TVOJ SUMMARY MORA BITI DOVOLJNO DETALJAN I BAZIRAN NA PORUKAMA KOJE TI JE
        STUDENT POSLAO. NAJBOLJE BI TI BILO IMATI KRATAK RAZGOVOR S NJIME (OTPRILIKE 10 NJEGOVIH PORUKA) IZ KOJEG ĆEŠ IZVUĆI SVE
        PROBLEME O KOJIMA TI STUDENT PRIĆA. AKO TI STUDENT ZADA JEDAN PROBLEM; TO NE MORA BITI JEDINI. PROBAJ KROZ RAZGOVOR 
        SKUŽITI O KOLIKO I KAKVIM PROBLEMIMA SE RADI, NEMOJ BRZATI (PRERANO ZAKLJUČITI O ČEMU TI SE STUDENT ŽALI).

        OBAVEZNO NAZAD VRATI CIJELI JSON OBJEKT PA MAKAR I OSTAVIO PRAZAN STRING AKO NISI USPIO OTKRITI NA PRIMJER GLAVNU
        KATEGORIJU.
        

    """

    messages_for_openai = [
        {
            "role": "system",
            "content": prompt,
        }
    ]

    for msg in messages:
                role = "user" if msg.sender == AssistantMessage.SENDER_STUDENT else "assistant"
                messages_for_openai.append({
                    "role": role,
                    "content": msg.content,
                })

    text = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages_for_openai,
                temperature=0.7,
                response_format={"type": "json_object"},
            ).choices[0].message.content
    
    #summary = summary.choices[0].message.content
    parsed = json.loads(text)
    return parsed
    # if parsed.get("recommendation_ready", ""):
    #     summary = parsed.get("summary", "")
    #     if not summary.strip():
    #         print("Error, summary nije izgeneriran")
    #         return
        
    #     AssistantSessionSummary.objects.create(
    #         student=session.student,
    #         session=session,
    #         content=summary,
    #     )
    #     session.is_active = False
    #     session.ended_at = timezone.now()
    #     session.save(update_fields=["is_active", "ended_at", "updated_at"])

    #     first = messages.first().content[:100]
    #     last = messages.last().content[:100]
    #     return f"Sesija ima {total} poruka. Prva poruka: '{first}'. Zadnja poruka: '{last}'."
    # else:
    #     return f"Došlo je do greške pri parsiranju json-a."



    




class StartSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        student = _get_student_from_request(request)
        if student is None:
            return Response({"message": "Korisnik nije student."}, status=status.HTTP_403_FORBIDDEN)

        session = AssistantSession.objects.filter(student=student, is_active=True).first()
        created = False
        session_messages=[]
        if session is None:
            session = AssistantSession.objects.create(student=student)
            created = True
        else:
            messages = AssistantMessage.objects.filter(session=session).order_by("sequence").all()
            for message in messages:
                serialized_message = AssistantMessageSerializer(message)
                session_messages.append(serialized_message.data)

        session_serialized = AssistantSessionSerializer(session)
        return Response(
            {
                "session": session_serialized.data,
                "messages": session_messages,
                "created": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class EndSesssionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        student = _get_student_from_request(request)
        if student is None:
            return Response({"message": "Korisnik nije student."}, status=status.HTTP_403_FORBIDDEN)

        session = AssistantSession.objects.filter(student=student, is_active=True).first()
        if session is None:
            return Response(
                {"message": "Nema aktivne sesije za ovog studenta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.is_active = False
        session.ended_at = timezone.now()
        session.save(update_fields=["is_active", "ended_at", "updated_at"])

        # summary, created = AssistantSessionSummary.objects.get_or_create(
        #     student=student,
        #     session=session,
        #     defaults={"content": generate_session_summary(session)},
        # )
        # if not created:
        #     # optionally refresh summary content
        #     summary.content = generate_session_summary(session)
        #     summary.save(update_fields=["content"])

        #serializer = AssistantSessionSummarySerializer(summary)
        return Response({'message': 'Uspješno napravljen summary'}, status=status.HTTP_200_OK)


class SessionMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatMessageRequestSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)

        student = _get_student_from_request(request)
        if student is None:
            return Response({"message": "Korisnik nije student."}, status=status.HTTP_403_FORBIDDEN)

        session = AssistantSession.objects.filter(student=student, is_active=True).first()
        if session is None:
            return Response(
                {"message": "Nema aktivne sesije. Pokrenite sesiju prije slanja poruka."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request_serializer = self.serializer_class(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        content = request_serializer.validated_data["content"]

        user_message = AssistantMessage.objects.create(
            session=session,
            sender=AssistantMessage.SENDER_STUDENT,
            content=content,
        )

        #bot_text = generate_bot_reply(session, user_message)
        
        #bot_message = generate_stream(session)

        
        bot_json = generate_bot_message(session)
        bot_message = AssistantMessage.objects.create(
            session=session,
            sender=AssistantMessage.SENDER_BOT,
            content=bot_json.get("message", "").strip(),
        )

        user_message_data = AssistantMessageSerializer(user_message).data
        bot_message_data = AssistantMessageSerializer(bot_message).data

        caretakers = []

        if bot_json.get("mode").lower() == "recommendation" and bot_json.get("recommendation_ready"): 
            if bot_json.get("summary").strip():
                AssistantSessionSummary.objects.create(
                    student=session.student,
                    session=session,
                    content=bot_json.get("summary"),
                )
                session.is_active = False
                session.ended_at = timezone.now()
                session.save(update_fields=["is_active", "ended_at", "updated_at"])
                try:
                    caretakers_query = Caretaker.objects.filter(
                         help_categories__label=bot_json.get("main_category"),
                         is_approved = True,
                         ).distinct()[:15]
                    for caretaker in caretakers_query:
                        # caretakers.append({
                        #     "first_name": caretaker.user.first_name,
                        #     "last_name": caretaker.user.last_name,
                        #     "sex": caretaker.user.sex,
                        #     "age": caretaker.user.age,
                        #     "image": caretaker.image if caretaker.image else False,
                        # })

                        serialized_caretaker = CaretakerLongSerializer(caretaker)
                        caretakers.append(serialized_caretaker.data)
                except Exception as e:
                    caretakers = []

                # {{
                #     "mode": "recommendation",
                #     "message": "<tvoja poruka korisniku>",
                #     "summary": "<anonimni sažetak problema>",
                #     "main_category": "<glavna kategorija>",
                #     "subcategories": ["<podkategorija1>", "<podkategorija2>"],
                #     "danger_flag": false,
                #     "recommendation_ready": true
                # }}
                # return response
            else:
                return Response({"error": "Došlo je do greške prilikom stvaranja summaryja"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        try:
            recommendation_ready = bot_json.get("recommendation_ready")
            if not recommendation_ready or not recommendation_ready:
                recommendation_ready = False
                
            else:
                recommendation_ready = True
        except Exception as e:
            recommendation_ready = False


        try:
            danger_flag = bot_json.get("danger_flag", "")
            if not danger_flag or not danger_flag.strip():
                danger_flag = False
                
            else:
                danger_flag = True
        except Exception as e:
            danger_flag = False

        response = Response(
            {
                "user_message": user_message_data, 
                "bot_message": bot_message_data, 
                "recommendation_ready": recommendation_ready,
                "danger_flag": danger_flag,
                "caretakers": caretakers
            },
            status=status.HTTP_201_CREATED,
        )

        return response
        # try:
        #     session_done = generate_session_summary(session)
        #     if session_done.startswith("Sesija ima "):
        #         return Response({'message': 'Sesija je završena, sada slijedi prijedlog psihologa'}, 
        #                         status=status.HTTP_200_OK)
        
        # except Exception as e:
        #     print(f"Došlo je do greške prilikom provjere je li razgovor gotov: {e}")
        #     return Response({'error': 'Greška kod stvaranja summaryja: {e}'}, 
        #                         status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        # #potrebna je samo bot poruka
        # return Response(
        #     {"user_message": user_message_data, "bot_message": bot_message_data},
        #     status=status.HTTP_201_CREATED,
        # )
        # response = StreamingHttpResponse(
        #     generate_stream(session=session),
        #     content_type="text/event-stream"
        # )

        # response['Cache-control'] = 'no-cache'
        # response['X-Accel-Buffering'] = 'no'

        #return response


class AssistantSummaryListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AssistantSessionSummarySerializer

    def get_queryset(self):
        student = _get_student_from_request(self.request)
        if student is None:
            return AssistantSessionSummary.objects.none()
        return (
            AssistantSessionSummary.objects.filter(student=student)
            .order_by("-created_at")
        )


class AssistantSummaryDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AssistantSessionSummarySerializer

    def get_queryset(self):
        student = _get_student_from_request(self.request)
        if student is None:
            return AssistantSessionSummary.objects.none()
        return AssistantSessionSummary.objects.filter(student=student)