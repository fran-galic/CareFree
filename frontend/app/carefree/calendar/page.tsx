"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/fetchers/fetcher"; 
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Video, Plus, RefreshCw } from "lucide-react";

// Tip podataka za event
interface CalendarEvent {
    id: number;
    summary: string;
    description: string;
    start: string;
    end: string;
    meet_link: string;
}

export default function CalendarPage() {
    // Dohvaćanje evenata s backenda
    const { data: events, error, isLoading } = useSWR<CalendarEvent[]>("/api/calendar/events/", fetcher);
    
    const [isCreating, setIsCreating] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newEvent, setNewEvent] = useState({
        summary: "",
        description: "",
        start_time: "",
        end_time: "",
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("hr-HR", {
            weekday: 'long', day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
        });
    };

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/calendar/create/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(newEvent),
            });

            if (!response.ok) throw new Error("Failed to create event");

            setNewEvent({ summary: "", description: "", start_time: "", end_time: "" });
            setIsCreating(false);
            mutate("/api/calendar/events/");
            alert("Event uspješno kreiran!");
        } catch (error) {
            console.error(error);
            alert("Greška pri kreiranju eventa");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/calendar/sync-now/`, {
                method: "POST",
                credentials: "include",
            });

            if (!response.ok) throw new Error("Sync failed");

            mutate("/api/calendar/events/");
            alert("Kalendar uspješno sinkroniziran!");
        } catch (error) {
            console.error(error);
            alert("Greška pri sinkronizaciji");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="container mx-auto py-8 max-w-4xl px-4 min-h-screen">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
                        <CalendarDays className="h-8 w-8" />
                        Moji Termini
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Pregled zakazanih razgovora i poveznice za Google Meet.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleSync} disabled={isSyncing} variant="outline">
                        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        Sinkroniziraj
                    </Button>
                    <Button onClick={() => setIsCreating(!isCreating)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novi event
                    </Button>
                </div>
            </div>

            {/* Forma za kreiranje novog eventa */}
            {isCreating && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Kreiraj novi event</CardTitle>
                        <CardDescription>Dodaj novi termin u kalendar</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateEvent} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="summary">Naziv</Label>
                                <Input
                                    id="summary"
                                    value={newEvent.summary}
                                    onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
                                    placeholder="Sastanak s psihologom"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Opis</Label>
                                <Textarea
                                    id="description"
                                    value={newEvent.description}
                                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                    placeholder="Dodatne informacije..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="start_time">Početak</Label>
                                    <Input
                                        id="start_time"
                                        type="datetime-local"
                                        value={newEvent.start_time}
                                        onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="end_time">Kraj</Label>
                                    <Input
                                        id="end_time"
                                        type="datetime-local"
                                        value={newEvent.end_time}
                                        onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                                    Odustani
                                </Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Kreiram..." : "Kreiraj event"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {isLoading && <div className="text-center py-10">Učitavanje kalendara...</div>}
            
            {error && (
                <Card className="border-yellow-400 bg-yellow-50 mb-6">
                    <CardContent className="p-4 text-yellow-800">
                        <p><strong>Napomena:</strong> Niste administrator ili backend ne dopušta pristup.</p>
                        <p className="text-sm mt-1">Backend trenutno dopušta pregled samo adminima (IsAdminUser).</p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && events?.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
                    <p>Nema zakazanih termina.</p>
                </div>
            )}

            <div className="grid gap-4">
                {events && events.map((event) => (
                    <Card key={event.id} className="border-l-4 border-l-primary">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>{event.summary || "Sastanak"}</CardTitle>
                                    <CardDescription className="mt-2 text-base font-medium">
                                        {formatDate(event.start)}
                                    </CardDescription>
                                </div>
                                {event.meet_link && (
                                    <a 
                                        href={event.meet_link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors font-medium text-sm"
                                    >
                                        <Video className="h-4 w-4" />
                                        Pridruži se
                                    </a>
                                )}
                            </div>
                        </CardHeader>
                        {event.description && (
                            <CardContent>
                                <p className="text-sm text-muted-foreground">{event.description}</p>
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
}