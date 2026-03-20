"use client";

import * as React from 'react';
import { useState } from 'react';
import useSWR from "swr";
import { searchCaretakerById } from "@/fetchers/users";
import { getCaretakerSlots, createAppointmentRequest, Slot } from "@/fetchers/appointments";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersistentAvatar } from "@/components/persistent-avatar-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Briefcase, 
  Clock, 
  CalendarCheck, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { getTwoWeekWindowDays, isPastDay } from "@/lib/calendar";

interface SlotsByDay {
  date: Date;
  dateStr: string;
  slots: Slot[];
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromLocalDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function ShowCaretakerInfo({ params }: { params: Promise<{ id: string }> }) {
  // Otpakiravanje parametara (Next.js 15 pattern)
  const { id } = React.use(params);
  
  // Dohvat podataka o psihologu s backenda
  const { data: caretaker, error, isLoading } = useSWR(id || null, (id) => searchCaretakerById(id));
  
  // Dohvat dostupnih slotova
  const { data: slotsData, error: slotsError, isLoading: slotsLoading } = useSWR(
    caretaker ? `slots-${id}` : null,
    () => getCaretakerSlots(Number(id), 14)
  );
  
  // State za formu
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookingNote, setBookingNote] = useState("");
  const [visibleWeekIndex, setVisibleWeekIndex] = useState(0);
  
  // State za loading i uspjeh
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBookingSuccess, setIsBookingSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Grupiraj slotove po danima
  const slotsByDay: SlotsByDay[] = React.useMemo(() => {
    if (!slotsData) return [];

    const grouped = new Map<string, Slot[]>(
      getTwoWeekWindowDays(new Date()).map((date) => [toLocalDateKey(date), []])
    );

    slotsData.forEach((slot: Slot) => {
      const date = new Date(slot.start);
      const dateStr = toLocalDateKey(date);
      if (grouped.has(dateStr)) {
        grouped.get(dateStr)!.push(slot);
      }
    });

    return Array.from(grouped.entries()).map(([dateStr, slots]) => ({
      date: fromLocalDateKey(dateStr),
      dateStr,
      slots: slots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    }));
  }, [slotsData]);

  const visibleSlotsByDay = React.useMemo(() => {
    const startIndex = visibleWeekIndex * 7;
    return slotsByDay.slice(startIndex, startIndex + 7);
  }, [slotsByDay, visibleWeekIndex]);

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

  const aboutText = caretaker.about_me?.trim();

  // --- FUNKCIJA REZERVACIJE ---
  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const slotDate = new Date(selectedSlot.start);
      const requestBody = {
        caretaker_id: Number(id),
        start_time: slotDate.toISOString().split('T')[0], // YYYY-MM-DD
        slot_time: selectedSlot.time,
        note: bookingNote,
      };

      await createAppointmentRequest(requestBody);

      // Prikaz UI-a za uspjeh
      setIsBookingSuccess(true);
      
      // Reset forme nakon 5 sekundi
      setTimeout(() => {
        setIsBookingSuccess(false);
        setSelectedSlot(null);
        setBookingNote("");
      }, 5000);

    } catch (err) {
      console.error("Greška:", err);
      setErrorMessage(err instanceof Error ? err.message : "Došlo je do greške");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* HEADER PROFILA - Kompaktan */}
      <div className="flex items-center gap-4 mb-8">
        <PersistentAvatar
          cacheKey={`avatar:caretaker-public:${caretaker.user_id}`}
          src={caretaker.user_image_url}
          alt={`${caretaker.first_name} ${caretaker.last_name}`}
          className="w-24 h-24 border-2 border-primary/20 shadow-lg"
          fallbackClassName="text-3xl font-bold bg-primary/10 text-primary"
          fallback={`${caretaker.first_name?.charAt(0) ?? ""}${caretaker.last_name?.charAt(0) ?? ""}`}
        />
        
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {caretaker.first_name} {caretaker.last_name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Briefcase className="w-3 h-3 mr-1" />
              Psiholog
            </Badge>
            {caretaker.grad_year && (
              <Badge variant="secondary" className="text-xs">
                Diploma {caretaker.grad_year}.
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* SADRŽAJ: TABS */}
      <Tabs defaultValue="booking" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="booking" className="gap-2">
            <CalendarCheck className="w-4 h-4" />
            Rezerviraj termin
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-2">
            <Briefcase className="w-4 h-4" />
            O meni
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: O MENI */}
        <TabsContent value="about" className="mt-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            
            {/* Područja rada */}
            <Card className="xl:col-span-1">
              <CardHeader className="pb-0">
                <CardTitle className="text-base font-medium">Područja rada</CardTitle>
              </CardHeader>
              <CardContent className="py-0">
                <div className="flex flex-wrap gap-2">
                  {caretaker.help_categories?.length > 0 ? (
                    caretaker.help_categories.map((cat: string, i: number) => (
                      <span key={i} className="px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium border border-primary/20">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Nema definiranih kategorija</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* O meni */}
            <Card className="xl:col-span-2">
              <CardHeader className="pb-1">
                <CardTitle className="text-base font-medium">O meni</CardTitle>
              </CardHeader>
              <CardContent className="py-0">
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {aboutText || "Psiholog još nije unio detaljan opis profila."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Profesionalni podaci
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 py-0">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Godina diplome</p>
                  <p className="mt-1 text-sm text-foreground">{caretaker.grad_year || "Nije navedeno"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status profila</p>
                  <p className="mt-1 text-sm text-foreground">
                    Profil je verificiran i vidljiv studentima unutar CareFree sustava.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Način rada</p>
                  <p className="mt-1 text-sm text-foreground">
                    Online savjetovanje kroz dogovorene termine i Google Meet pozive.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Privatnost i sigurnost
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 py-0 text-sm leading-6 text-muted-foreground">
                <p>Detalji koje napišete uz zahtjev vidljivi su samo vama i psihologu kojem šaljete upit.</p>
                <p>Kontakt podaci prikazuju se samo ako ih je psiholog odlučio podijeliti sa studentima.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Što možete očekivati
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 py-0 text-sm leading-6 text-muted-foreground">
                <p>Prvi razgovor služi upoznavanju, definiranju izazova i dogovoru oko najboljeg smjera podrške.</p>
                <p>Nakon slanja zahtjeva psiholog potvrđuje termin, a potvrda i Google Meet link stižu e-mailom.</p>
              </CardContent>
            </Card>

            {(caretaker.contact_email || caretaker.contact_phone) && (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardHeader className="pb-0">
                  <CardTitle className="text-base font-medium">Kontakt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-2 pb-0">
                  {caretaker.contact_email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 text-primary" />
                      <span>{caretaker.contact_email}</span>
                    </div>
                  )}
                  {caretaker.contact_phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 text-primary" />
                      <span>{caretaker.contact_phone}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: REZERVACIJA */}
        <TabsContent value="booking" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-primary" />
                  Dostupni termini
                </CardTitle>
                <CardDescription>
                  Odaberite termin za slanje zahtjeva. Psiholog će potvrditi termin nakon pregleda vašeg upita.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 rounded-xl border border-primary/10 bg-primary/5 p-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">1. Odaberite termin</p>
                    <p className="mt-1 text-sm text-muted-foreground">Kliknite slobodan termin koji vam odgovara.</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">2. Napišite razlog dolaska</p>
                    <p className="mt-1 text-sm text-muted-foreground">Dovoljno je nekoliko rečenica koje psiholog vidi prije potvrde.</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">3. Pričekajte potvrdu</p>
                    <p className="mt-1 text-sm text-muted-foreground">Nakon potvrde dobit ćete obavijest i Google Meet link.</p>
                  </div>
                </div>

                  {slotsError && (
                    <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
                      <AlertCircle className="w-5 h-5" />
                      <p>Greška pri učitavanju termina</p>
                    </div>
                  )}

                  {slotsLoading && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-32 w-full" />
                        </div>
                      ))}
                    </div>
                  )}

                  {!slotsLoading && !slotsError && slotsByDay.every((day) => day.slots.length === 0) && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Trenutno nema dostupnih termina</p>
                    </div>
                  )}

                  {!slotsLoading && !slotsError && slotsByDay.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/80 px-3 py-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 cursor-pointer disabled:cursor-not-allowed"
                          disabled={visibleWeekIndex === 0}
                          onClick={() => setVisibleWeekIndex(0)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-center">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {visibleWeekIndex === 0 ? "Ovaj tjedan" : "Sljedeći tjedan"}
                          </p>
                          {visibleSlotsByDay.length > 0 ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {visibleSlotsByDay[0].date.toLocaleDateString("hr-HR", { day: "numeric", month: "long" })}
                              {" - "}
                              {visibleSlotsByDay[visibleSlotsByDay.length - 1].date.toLocaleDateString("hr-HR", { day: "numeric", month: "long" })}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 cursor-pointer disabled:cursor-not-allowed"
                          disabled={visibleWeekIndex === 1}
                          onClick={() => setVisibleWeekIndex(1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
                      {visibleSlotsByDay.map((day, dayIdx) => (
                        <div key={dayIdx} className="space-y-2 rounded-xl border border-border/70 bg-card/80 p-2">
                          <h4 className={`rounded-md py-1.5 text-center text-[11px] font-semibold ${isPastDay(day.date) ? "bg-slate-200 text-slate-500" : "bg-muted"}`}>
                            {day.date.toLocaleDateString('hr-HR', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                          </h4>
                          <div className="grid grid-cols-1 gap-1.5">
                            {day.slots.length > 0 ? day.slots.map((slot, slotIdx) => {
                              const slotDate = new Date(slot.start);
                              const isPastSlot = slotDate.getTime() < Date.now();
                              const isDisabled = !slot.is_available || isPastSlot;

                              return (
                              <Button
                                key={slotIdx}
                                variant={slot.is_available ? "outline" : "ghost"}
                                disabled={isDisabled}
                                className={`h-8 w-full px-1.5 text-[11px] ${isPastSlot
                                  ? "border border-slate-200 bg-slate-100 text-slate-400"
                                  : slot.is_available 
                                  ? selectedSlot?.start === slot.start
                                      ? 'border-[#256b61] bg-[#256b61] text-white ring-1 ring-[#256b61] shadow-sm'
                                      : 'border-[#4a9a8d] bg-[#69b3a6] text-white shadow-sm hover:border-[#256b61] hover:bg-[#5ba698] hover:text-white'
                                  : 'border border-border/80 bg-[#fbfcfb] text-muted-foreground opacity-100'
                                }`}
                                onClick={() => !isDisabled && setSelectedSlot(slot)}
                              >
                                {slot.time}
                              </Button>
                              );
                            }) : (
                              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-2.5 text-center text-[11px] text-slate-400">
                                {isPastDay(day.date) ? "Prošlo" : "Nema termina"}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    </div>
                  )}
              </CardContent>
            </Card>

            <Card className={`border-l-4 transition-colors ${selectedSlot ? 'border-l-primary' : 'border-l-muted'}`}>
              <CardHeader>
                <CardTitle>Vaš odabir</CardTitle>
                <CardDescription>
                  Nakon odabira termina ispunite kratku napomenu kako bi psiholog imao kontekst prije potvrde.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedSlot ? (
                  <div className="py-8 text-center text-muted-foreground animate-in fade-in">
                    <Clock className="mx-auto mb-3 h-12 w-12 opacity-20" />
                    <p>Kliknite na slobodan termin iz gornjeg rasporeda za početak rezervacije.</p>
                  </div>
                ) : isBookingSuccess ? (
                  <div className="space-y-4 py-8 text-center animate-in zoom-in duration-300">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 shadow-sm">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-green-700">Zahtjev poslan!</h3>
                      <p className="mt-2 px-4 text-sm text-muted-foreground">
                        Psiholog će pregledati vaš zahtjev. Potvrda i <strong>Google Meet</strong> link stići će vam e-mailom uskoro.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleBooking} className="grid gap-6 lg:grid-cols-[0.95fr_1.4fr] animate-in slide-in-from-bottom-4 duration-300">
                    <div className="rounded-xl border border-primary/10 bg-primary/5 p-5 space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">Odabrani termin</p>
                      <p className="text-xl font-semibold">
                        {new Date(selectedSlot.start).toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <p className="text-3xl font-bold text-primary">
                        {selectedSlot.time}
                      </p>
                      <p className="pt-2 text-sm leading-6 text-muted-foreground">
                        Ako vam termin ipak ne odgovara, možete odabrati drugi ili odustati prije slanja zahtjeva.
                      </p>
                    </div>

                    <div className="space-y-5">
                      {errorMessage && (
                        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                          <AlertCircle className="mt-0.5 h-4 w-4" />
                          <p>{errorMessage}</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          Razlog dolaska
                          <span className="text-xs font-normal text-muted-foreground">(kratko)</span>
                        </label>
                        <Textarea 
                          placeholder="Npr. osjećam veliku anksioznost prije ispita..."
                          value={bookingNote}
                          onChange={(e) => setBookingNote(e.target.value)}
                          required
                          rows={5}
                          className="resize-none"
                        />
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <AlertCircle className="h-3 w-3" />
                          Ovaj opis vidljiv je samo psihologu.
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => {
                          setSelectedSlot(null);
                          setErrorMessage(null);
                        }}>
                          Odustani
                        </Button>
                        <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                          {isSubmitting ? "Slanje..." : "Pošalji zahtjev"}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
