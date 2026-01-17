"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { hr } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, ExternalLink, Video, User, Clock } from "lucide-react";
import { getCaretakerAppointments, type Appointment } from "@/fetchers/appointments";

const locales = {
  hr: hr,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

export default function AvailabilityPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Provjeri Google Calendar status
        const statusRes = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/calendar/status/`,
          { credentials: "include" }
        );
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setGoogleConnected(statusData.connected || false);
        }
      } catch (error) {
        console.error("Greška pri provjeri Google statusa:", error);
      } finally {
        setCheckingGoogle(false);
      }

      try {
        const data = await getCaretakerAppointments();
        setAppointments(data);
      } catch (error) {
        console.error("Greška pri dohvaćanju termina:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const events: CalendarEvent[] = useMemo(() => {
    return appointments.map((apt) => ({
      id: apt.id,
      title: apt.student
        ? `${apt.student.first_name} ${apt.student.last_name}`
        : "Student",
      start: new Date(apt.start),
      end: new Date(apt.end),
      resource: apt,
    }));
  }, [appointments]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const status = event.resource.status;
    let backgroundColor = "#3b82f6"; // default blue

    if (status === "completed") backgroundColor = "#10b981"; // green
    if (status === "cancelled") backgroundColor = "#ef4444"; // red
    if (status === "confirmed") backgroundColor = "#8b5cf6"; // purple

    return {
      style: {
        backgroundColor,
        borderRadius: "6px",
        opacity: 0.9,
        color: "white",
        border: "none",
        display: "block",
      },
    };
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  const handleViewChange = useCallback((newView: View) => {
    setView(newView);
  }, []);

  const handleGoogleCalendarSync = async () => {
    if (!googleConnected) {
      // Redirect to Google OAuth flow
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/calendar/connect/`,
          { credentials: "include" }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.auth_url) {
            window.location.href = data.auth_url;
          }
        } else {
          alert("Greška pri povezivanju s Google Calendarom");
        }
      } catch (error) {
        console.error("Greška:", error);
        alert("Greška pri povezivanju s Google Calendarom");
      }
    } else {
      // Already connected, sync now
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/calendar/sync-now/`,
          {
            method: "POST",
            credentials: "include",
          }
        );

        if (response.ok) {
          alert("Uspješno sinkronizirano s Google Calendarom!");
        } else {
          alert("Greška pri sinkronizaciji");
        }
      } catch (error) {
        console.error("Greška:", error);
        alert("Greška pri sinkronizaciji");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Moj Kalendar</h1>
          <p className="text-muted-foreground">
            Pregled svih zakazanih termina
          </p>
        </div>
        {!checkingGoogle && (
          <Button 
            onClick={handleGoogleCalendarSync} 
            className="gap-2"
            variant={googleConnected ? "default" : "outline"}
          >
            <ExternalLink className="w-4 h-4" />
            {googleConnected 
              ? "Sinkroniziraj s Google Calendarom" 
              : "Poveži Google Calendar"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Kalendar termina
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white rounded-lg p-4" style={{ height: "600px" }}>
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: "100%" }}
                  view={view}
                  onView={handleViewChange}
                  date={date}
                  onNavigate={handleNavigate}
                  onSelectEvent={handleSelectEvent}
                  eventPropGetter={eventStyleGetter}
                  messages={{
                    next: "Sljedeći",
                    previous: "Prethodni",
                    today: "Danas",
                    month: "Mjesec",
                    week: "Tjedan",
                    day: "Dan",
                    agenda: "Agenda",
                    date: "Datum",
                    time: "Vrijeme",
                    event: "Događaj",
                    noEventsInRange: "Nema događaja u ovom periodu.",
                    showMore: (total) => `+ još ${total}`,
                  }}
                  culture="hr"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Detalji termina</CardTitle>
              <CardDescription>
                {selectedEvent
                  ? "Odabrani termin"
                  : "Klikni na termin za detalje"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedEvent ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">Student</span>
                    </div>
                    <p className="text-sm">
                      {selectedEvent.resource.student?.first_name}{" "}
                      {selectedEvent.resource.student?.last_name}
                    </p>
                    {selectedEvent.resource.student?.email && (
                      <p className="text-sm text-muted-foreground">
                        {selectedEvent.resource.student.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">Vrijeme</span>
                    </div>
                    <p className="text-sm">
                      {format(selectedEvent.start, "PPP HH:mm", { locale: hr })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Trajanje: {selectedEvent.resource.duration_minutes} min
                    </p>
                  </div>

                  <div>
                    <span className="font-semibold block mb-2">Status</span>
                    <Badge
                      variant={
                        selectedEvent.resource.status === "completed"
                          ? "default"
                          : selectedEvent.resource.status === "cancelled"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {selectedEvent.resource.status === "confirmed" && "Potvrđeno"}
                      {selectedEvent.resource.status === "completed" && "Završeno"}
                      {selectedEvent.resource.status === "cancelled" && "Otkazano"}
                      {selectedEvent.resource.status === "scheduled" && "Zakazano"}
                    </Badge>
                  </div>

                  {selectedEvent.resource.conference_link && (
                    <div>
                      <Button
                        className="w-full gap-2"
                        onClick={() =>
                          window.open(
                            selectedEvent.resource.conference_link,
                            "_blank"
                          )
                        }
                      >
                        <Video className="w-4 h-4" />
                        Pridruži se sastanku
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">
                    Odaberi termin na kalendaru za prikaz detalja
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Statistika</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Ukupno termina
                </span>
                <span className="font-semibold">{appointments.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Potvrđeni
                </span>
                <span className="font-semibold text-purple-600">
                  {
                    appointments.filter((a) => a.status === "confirmed")
                      .length
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Završeni
                </span>
                <span className="font-semibold text-green-600">
                  {
                    appointments.filter((a) => a.status === "completed")
                      .length
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Otkazani
                </span>
                <span className="font-semibold text-red-600">
                  {
                    appointments.filter((a) => a.status === "cancelled")
                      .length
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
