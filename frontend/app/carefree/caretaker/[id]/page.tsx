"use client";

import * as React from 'react';
import { useState } from 'react';
import useSWR from "swr";
import { searchCaretakerById } from "@/fetchers/users";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  MapPin, 
  Phone, 
  Briefcase, 
  Clock, 
  CalendarCheck, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

// --- MOCK LOGIKA ZA KALENDAR ---
// Generiramo termine za iduća 3 dana, od 08:00 do 18:00
const generateMockSlots = () => {
  const days = [];
  const today = new Date();
  
  for (let i = 1; i <= 3; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      // Nasumično odluči je li termin slobodan (70% šanse da je slobodan radi demo-a)
      const isFree = Math.random() > 0.3;
      slots.push({
        time: `${hour.toString().padStart(2, '0')}:00`,
        isFree: isFree
      });
    }
    days.push({ date: date, slots: slots });
  }
  return days;
};

export default function ShowCaretakerInfo({ params }: { params: Promise<{ id: string }> }) {
  // Otpakiravanje parametara (Next.js 15 pattern)
  const { id } = React.use(params);
  
  // Dohvat podataka o psihologu s backenda
  const { data: caretaker, error, isLoading } = useSWR(id || null, (id) => searchCaretakerById(id));
  
  // State za kalendar i formu
  const [mockSchedule] = useState(generateMockSlots());
  const [selectedSlot, setSelectedSlot] = useState<{date: Date, time: string} | null>(null);
  const [bookingNote, setBookingNote] = useState("");
  
  // State za loading i uspjeh
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBookingSuccess, setIsBookingSuccess] = useState(false);

  // --- RUKOVANJE GREŠKAMA I LOADINGOM ---
  if (error) return (
    <div className="container mx-auto mt-10 p-4">
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="p-6 flex items-center gap-3 text-destructive">
          <AlertCircle />
          <p>Ne možemo učitati podatke o psihologu. Pokušajte kasnije.</p>
        </CardContent>
      </Card>
    </div>
  );

  if ((!caretaker && isLoading) || !caretaker) return (
    <div className="container mx-auto mt-20 text-center flex flex-col items-center gap-4">
       <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
       <p className="text-muted-foreground">Učitavanje profila...</p>
    </div>
  );

  // --- FUNKCIJA REZERVACIJE (Smart Facade) ---
  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    
    setIsSubmitting(true);

    try {
      // 1. Priprema podataka
      const requestBody = {
        caretaker_id: id,
        start_time: selectedSlot.date.toISOString(), // pojednostavljeni datum
        slot_time: selectedSlot.time,
        note: bookingNote,
      };

      console.log("Slanje zahtjeva na backend:", requestBody);

      // 2. Pokušaj slanja na (vjerojatno nepostojeći) endpoint
      // Ovo služi da backend tim vidi što točno šalješ
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/appointments/request/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Šalje auth kolačiće
        body: JSON.stringify(requestBody),
      });

      // 3. SIMULACIJA USPJEHA (FALLBACK)
      // Ako endpoint vrati 404 (jer backend tim još nije gotov), mi glumimo da je prošlo
      if (!response.ok && response.status !== 404) {
         throw new Error("Stvarna greška na serveru.");
      }
      
      if (response.status === 404) {
          console.warn("Endpoint '/api/appointments/request/' ne postoji. Simuliram uspjeh radi UX demoa.");
          // Simuliramo mrežni delay od 1.5 sekunde
          await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // 4. Prikaz UI-a za uspjeh
      setIsBookingSuccess(true);
      
      // Reset forme nakon 4 sekunde
      setTimeout(() => {
        setIsBookingSuccess(false);
        setSelectedSlot(null);
        setBookingNote("");
      }, 4000);

    } catch (err) {
      console.error("Greška:", err);
      alert("Došlo je do greške prilikom slanja zahtjeva.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      {/* HEADER PROFILA */}
      <Card className="mb-8 overflow-hidden border-none shadow-md bg-card">
        <div className="h-16"></div>
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <Avatar className="w-32 h-32 border-4 border-background shadow-lg">
              <AvatarImage src={caretaker.user_image_url || ""} className="object-cover" />
              <AvatarFallback className="text-3xl font-bold bg-muted text-muted-foreground">
                {caretaker.first_name?.charAt(0)}{caretaker.last_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {/* Status badge */}
            <div className="hidden md:flex gap-2 mb-2">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold border border-primary/20 flex items-center gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                Dostupan za nove klijente
              </span>
            </div>
          </div>
          
          <div>
            <h1 className="text-3xl font-bold text-foreground">{caretaker.first_name} {caretaker.last_name}</h1>
            <p className="text-lg text-muted-foreground font-medium mt-1">
              {caretaker.academic_title} • {caretaker.specialisation || "Psiholog"}
            </p>
            
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
              {caretaker.working_since && (
                <div className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  <span>Iskustvo od {caretaker.working_since}.</span>
                </div>
              )}
              {caretaker.office_address && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{caretaker.office_address}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* SADRŽAJ: TABS */}
      <Tabs defaultValue="about" className="w-full">
        <TabsList className="w-full justify-start h-12 bg-transparent border-b rounded-none p-0 space-x-6 mb-6">
          <TabsTrigger 
            value="about" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-4 pb-3 pt-2 font-semibold text-base bg-transparent"
          >
            O meni
          </TabsTrigger>
          <TabsTrigger 
            value="booking" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-4 pb-3 pt-2 font-semibold text-base bg-transparent"
          >
            Rezerviraj termin
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: O MENI */}
        <TabsContent value="about" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Biografija</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                    {caretaker.about_me || "Korisnik nije unio detaljan opis."}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Područja rada</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {caretaker.help_categories?.length > 0 ? (
                      caretaker.help_categories.map((cat: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-secondary text-secondary-foreground rounded-md text-sm font-medium">
                          {cat}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground italic">Nema definiranih kategorija.</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Kontakt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full text-primary">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefon</p>
                      <p className="font-medium">{caretaker.tel_num || "Nije dostupno"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full text-primary">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lokacija</p>
                      <p className="font-medium">{caretaker.office_address || "Online / Nije navedeno"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: REZERVACIJA (SIMULACIJA ZAHTJEVA) */}
        <TabsContent value="booking" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* LIJEVA STRANA: KALENDAR (Mock) */}
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-primary" />
                    Dostupni termini
                  </CardTitle>
                  <CardDescription>
                    Odaberite termin za slanje zahtjeva. Psiholog će potvrditi termin.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {mockSchedule.map((day, dayIdx) => (
                      <div key={dayIdx} className="space-y-3">
                        <h4 className="font-semibold text-center py-2 bg-muted rounded-md text-sm">
                          {day.date.toLocaleDateString('hr-HR', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {day.slots.map((slot, slotIdx) => (
                            <Button
                              key={slotIdx}
                              variant={slot.isFree ? "outline" : "ghost"}
                              disabled={!slot.isFree}
                              className={`w-full ${slot.isFree 
                                ? selectedSlot?.date === day.date && selectedSlot?.time === slot.time 
                                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' 
                                    : 'hover:border-primary hover:text-primary' 
                                : 'opacity-40 cursor-not-allowed bg-muted/50'
                              }`}
                              onClick={() => setSelectedSlot({ date: day.date, time: slot.time })}
                            >
                              {slot.time}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* DESNA STRANA: FORMA ZA SLANJE ZAHTJEVA */}
            <div className="md:col-span-1">
              <Card className={`sticky top-6 border-l-4 transition-colors ${selectedSlot ? 'border-l-primary' : 'border-l-muted'}`}>
                <CardHeader>
                  <CardTitle>Vaš odabir</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedSlot ? (
                    <div className="text-center py-8 text-muted-foreground animate-in fade-in">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Kliknite na slobodan termin (lijevo) za početak rezervacije.</p>
                    </div>
                  ) : isBookingSuccess ? (
                    <div className="text-center py-8 space-y-4 animate-in zoom-in duration-300">
                      <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-green-700">Zahtjev poslan!</h3>
                        <p className="text-sm text-muted-foreground mt-2 px-4">
                          Psiholog će pregledati vaš zahtjev. <br/>
                          Potvrda i <strong>Google Meet</strong> link stići će vam e-mailom uskoro.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleBooking} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                      <div className="bg-primary/5 p-5 rounded-xl border border-primary/10 space-y-1">
                        <p className="text-xs font-bold text-primary uppercase tracking-wide">Odabrani Termin</p>
                        <p className="font-semibold text-xl">
                          {selectedSlot.date.toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <p className="text-3xl font-bold text-primary">
                          {selectedSlot.time} h
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            Razlog dolaska 
                            <span className="text-xs font-normal text-muted-foreground">(kratko)</span>
                        </label>
                        <Textarea 
                          placeholder="Npr. osjećam veliku anksioznost prije ispita..."
                          value={bookingNote}
                          onChange={(e) => setBookingNote(e.target.value)}
                          required
                          rows={4}
                          className="resize-none"
                        />
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                           <AlertCircle className="w-3 h-3"/> 
                           Ovaj opis vidljiv je samo psihologu i AI asistentu za sažimanje.
                        </p>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setSelectedSlot(null)}>
                          Odustani
                        </Button>
                        <Button type="submit" className="flex-1" disabled={isSubmitting}>
                          {isSubmitting ? "Slanje..." : "Pošalji zahtjev"}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}