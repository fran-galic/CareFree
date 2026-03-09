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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Loader2
} from "lucide-react";

interface SlotsByDay {
  date: Date;
  dateStr: string;
  slots: Slot[];
}

export default function ShowCaretakerInfo({ params }: { params: Promise<{ id: string }> }) {
  // Otpakiravanje parametara (Next.js 15 pattern)
  const { id } = React.use(params);
  
  // Dohvat podataka o psihologu s backenda
  const { data: caretaker, error, isLoading } = useSWR(id || null, (id) => searchCaretakerById(id));
  
  // Dohvat dostupnih slotova
  const { data: slotsData, error: slotsError, isLoading: slotsLoading } = useSWR(
    caretaker ? `slots-${id}` : null,
    () => getCaretakerSlots(Number(id), 7)
  );
  
  // State za formu
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookingNote, setBookingNote] = useState("");
  
  // State za loading i uspjeh
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBookingSuccess, setIsBookingSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Grupiraj slotove po danima
  const slotsByDay: SlotsByDay[] = React.useMemo(() => {
    if (!slotsData) return [];
    
    const grouped = new Map<string, Slot[]>();
    
    slotsData.forEach((slot: Slot) => {
      const date = new Date(slot.start);
      const dateStr = date.toISOString().split('T')[0];
      
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, []);
      }
      grouped.get(dateStr)!.push(slot);
    });
    
    return Array.from(grouped.entries()).map(([dateStr, slots]) => ({
      date: new Date(dateStr),
      dateStr,
      slots: slots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    }));
  }, [slotsData]);

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
        <Avatar className="w-24 h-24 border-2 border-primary/20 shadow-lg">
          <AvatarImage src={caretaker.user_image_url || ""} className="object-cover" />
          <AvatarFallback className="text-3xl font-bold bg-primary/10 text-primary">
            {caretaker.first_name?.charAt(0)}{caretaker.last_name?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {caretaker.first_name} {caretaker.last_name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              <Briefcase className="w-3 h-3 mr-1" />
              Psiholog
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-muted-foreground">
              {caretaker.academic_title} {caretaker.specialisation ? `• ${caretaker.specialisation}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* SADRŽAJ: TABS */}
      <Tabs defaultValue="about" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="about" className="gap-2">
            <Briefcase className="w-4 h-4" />
            O meni
          </TabsTrigger>
          <TabsTrigger value="booking" className="gap-2">
            <CalendarCheck className="w-4 h-4" />
            Rezerviraj termin
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: O MENI */}
        <TabsContent value="about" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Područja rada */}
            <Card>
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
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-base font-medium">O meni</CardTitle>
              </CardHeader>
              <CardContent className="py-0">
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {caretaker.about_me || "Korisnik nije unio detaljan opis."}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: REZERVACIJA */}
        <TabsContent value="booking" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* LIJEVA STRANA: KALENDAR */}
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
                  {slotsError && (
                    <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
                      <AlertCircle className="w-5 h-5" />
                      <p>Greška pri učitavanju termina</p>
                    </div>
                  )}

                  {slotsLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-32 w-full" />
                        </div>
                      ))}
                    </div>
                  )}

                  {!slotsLoading && !slotsError && slotsByDay.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Trenutno nema dostupnih termina</p>
                    </div>
                  )}

                  {!slotsLoading && !slotsError && slotsByDay.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {slotsByDay.map((day, dayIdx) => (
                        <div key={dayIdx} className="space-y-3">
                          <h4 className="font-semibold text-center py-2 bg-muted rounded-md text-sm">
                            {day.date.toLocaleDateString('hr-HR', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                            {day.slots.map((slot, slotIdx) => (
                              <Button
                                key={slotIdx}
                                variant={slot.is_available ? "outline" : "ghost"}
                                disabled={!slot.is_available}
                                className={`w-full ${slot.is_available 
                                  ? selectedSlot?.start === slot.start
                                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' 
                                      : 'hover:border-primary hover:text-primary' 
                                  : 'opacity-40 cursor-not-allowed bg-muted/50'
                                }`}
                                onClick={() => setSelectedSlot(slot)}
                              >
                                {slot.time}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                      {errorMessage && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5" />
                          <p>{errorMessage}</p>
                        </div>
                      )}

                      <div className="bg-primary/5 p-5 rounded-xl border border-primary/10 space-y-1">
                        <p className="text-xs font-bold text-primary uppercase tracking-wide">Odabrani Termin</p>
                        <p className="font-semibold text-xl">
                          {new Date(selectedSlot.start).toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <p className="text-3xl font-bold text-primary">
                          {selectedSlot.time}
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
                           Ovaj opis vidljiv je samo psihologu.
                        </p>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => {
                          setSelectedSlot(null);
                          setErrorMessage(null);
                        }}>
                          Odustani
                        </Button>
                        <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
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
