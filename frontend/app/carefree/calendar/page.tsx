"use client";

import useSWR from "swr";
import { fetcher } from "@/fetchers/fetcher"; 
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { CalendarDays, Video } from "lucide-react";

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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("hr-HR", {
            weekday: 'long', day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
        });
    };

    return (
        <div className="container mx-auto py-8 max-w-4xl px-4 min-h-screen">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
                    <CalendarDays className="h-8 w-8" />
                    Moji Termini
                </h1>
                <p className="text-muted-foreground mt-1">
                    Pregled zakazanih razgovora i poveznice za Google Meet.
                </p>
            </div>

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