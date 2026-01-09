"use client";

import * as React from 'react'
import { useState } from 'react';
import useSWR from "swr";
import { searchCaretakerById } from "@/fetchers/users"
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
  CardHeader,
  CardFooter
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge" // Ako nemas Badge, koristi span sa stilovima
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
    MapPin, 
    Phone, 
    Briefcase, 
    Clock, 
    CalendarCheck, 
    CheckCircle2, 
    X,
    AlertCircle
} from "lucide-react"

// --- MOCK LOGIKA ZA KALENDAR ---
// Generiramo termine za idućih 3 dana, od 08:00 do 20:00 (Julijina preporuka)
const generateMockSlots = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 1; i <= 3; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        const slots = [];
        for (let hour = 8; hour < 20; hour++) {
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
    const { id } = React.use(params)
    const { data: caretaker, error, isLoading } = useSWR(id || null, (id) => searchCaretakerById(id))
    
    // State za kalendar i modal
    const [mockSchedule] = useState(generateMockSlots());
    const [selectedSlot, setSelectedSlot] = useState<{date: Date, time: string} | null>(null);
    const [bookingNote, setBookingNote] = useState("");
    const [isBookingSuccess, setIsBookingSuccess] = useState(false);

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

    if (!caretaker && isLoading) return <div className="container mx-auto mt-20 text-center">Učitavanje profila...</div>;

    // --- FUNKCIJA REZERVACIJE ---
    const handleBooking = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Ovdje bi išao POST zahtjev na backend: /api/appointments/request
        // Budući da endpoint ne postoji, simuliramo uspjeh
        console.log("Rezervacija poslana:", {
            caretakerId: id,
            date: selectedSlot?.date,
            time: selectedSlot?.time,
            note: bookingNote
        });

        setIsBookingSuccess(true);
        // Reset nakon 3 sekunde
        setTimeout(() => {
            setIsBookingSuccess(false);
            setSelectedSlot(null);
            setBookingNote("");
        }, 3000);
    };

    return (
        <div className="container mx-auto py-10 px-4 max-w-5xl">
            {/* HEADER PROFILA */}
            <Card className="mb-8 overflow-hidden border-none shadow-md">
                <div className="h-32 bg-gradient-to-r from-primary/10 to-primary/5"></div>
                <div className="px-8 pb-8">
                    <div className="relative flex justify-between items-end -mt-12 mb-6">
                        <Avatar className="w-32 h-32 border-4 border-background shadow-lg">
                            <AvatarImage src={caretaker.user_image_url || ""} />
                            <AvatarFallback className="text-3xl font-bold bg-primary/20 text-primary">
                                {caretaker.first_name?.charAt(0)}{caretaker.last_name?.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        {/* Status badge (Fake) */}
                        <div className="hidden md:flex gap-2 mb-2">
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold border border-green-200 flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
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
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2 font-semibold text-base"
                    >
                        O meni
                    </TabsTrigger>
                    <TabsTrigger 
                        value="booking" 
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2 font-semibold text-base"
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
                                        {caretaker.about_me || "Korisnik nije unio opis."}
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
                                            <p className="font-medium">{caretaker.office_address || "Online"}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 2: REZERVACIJA (MOCK CALENDAR) */}
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
                                        Odaberite termin koji vam odgovara. Trajanje termina je 60 minuta.
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
                                                                ? 'hover:border-primary hover:text-primary' 
                                                                : 'opacity-50 cursor-not-allowed bg-muted/50'
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

                        {/* DESNA STRANA: FORMA ZA POTVRDU */}
                        <div className="md:col-span-1">
                            <Card className={`sticky top-6 border-l-4 ${selectedSlot ? 'border-l-primary' : 'border-l-muted'}`}>
                                <CardHeader>
                                    <CardTitle>Vaš odabir</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {!selectedSlot ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>Kliknite na slobodan termin (lijevo) za početak rezervacije.</p>
                                        </div>
                                    ) : isBookingSuccess ? (
                                        <div className="text-center py-6 space-y-4 animate-in zoom-in duration-300">
                                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                                                <CheckCircle2 className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-green-700">Zahtjev poslan!</h3>
                                                <p className="text-sm text-muted-foreground mt-2">
                                                    Psiholog će pregledati vaš zahtjev. Obavijestit ćemo vas e-mailom.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleBooking} className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                            <div className="bg-primary/5 p-4 rounded-lg space-y-1">
                                                <p className="text-xs font-bold text-primary uppercase tracking-wide">Termin</p>
                                                <p className="font-semibold text-lg">
                                                    {selectedSlot.date.toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                </p>
                                                <p className="text-2xl font-bold text-primary">
                                                    {selectedSlot.time} h
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Razlog dolaska (kratko)</label>
                                                <Textarea 
                                                    placeholder="Npr. osjećam veliku anksioznost prije ispita..."
                                                    value={bookingNote}
                                                    onChange={(e) => setBookingNote(e.target.value)}
                                                    required
                                                    rows={3}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Ovaj opis vidljiv je samo psihologu.
                                                </p>
                                            </div>

                                            <div className="flex gap-2 pt-2">
                                                <Button type="button" variant="ghost" className="flex-1" onClick={() => setSelectedSlot(null)}>
                                                    Odustani
                                                </Button>
                                                <Button type="submit" className="flex-1">
                                                    Pošalji zahtjev
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
    )
}