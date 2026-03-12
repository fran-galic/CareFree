"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, dateFnsLocalizer, View, ToolbarProps } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { hr } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, Video, User, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { getMyAppointments, type Appointment } from "@/fetchers/appointments";
import { Button } from "@/components/ui/button";

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

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ top: number; left: number } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getMyAppointments();
        setAppointments(data);
      } catch (error) {
        console.error("Greška pri dohvaćanju termina:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Auto-select appointment from URL parameter
  useEffect(() => {
    const appointmentId = searchParams.get('appointment');
    if (appointmentId && appointments.length > 0) {
      const apt = appointments.find(a => a.id === parseInt(appointmentId));
      if (apt) {
        const event: CalendarEvent = {
          id: apt.id,
          title: apt.caretaker
            ? `${apt.caretaker.first_name} ${apt.caretaker.last_name}`
            : "Psiholog",
          start: new Date(apt.start),
          end: new Date(apt.end),
          resource: apt,
        };
        setSelectedEvent(event);
        setDate(new Date(apt.start));
        
        // Clean up URL parameter
        const url = new URL(window.location.href);
        url.searchParams.delete('appointment');
        window.history.replaceState({}, '', url.pathname);
      }
    }
  }, [searchParams, appointments]);

  const events: CalendarEvent[] = useMemo(() => {
    return appointments.map((apt) => ({
      id: apt.id,
      title: apt.caretaker
        ? `${apt.caretaker.first_name} ${apt.caretaker.last_name}`
        : "Psiholog",
      start: new Date(apt.start),
      end: new Date(apt.end),
      resource: apt,
    }));
  }, [appointments]);

  const getEventTitle = useCallback((event: CalendarEvent) => {
    const caretaker = event.resource.caretaker;
    if (!caretaker) {
      return "Termin";
    }

    return `${caretaker.first_name} ${caretaker.last_name}`;
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    if (status === "confirmed") return "Potvrđeno";
    if (status === "completed") return "Završeno";
    if (status === "cancelled") return "Otkazano";
    if (status === "confirmed_pending_sync") return "Potvrda u tijeku";
    return "Zakazano";
  }, []);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const status = event.resource.status;
    let backgroundColor = "#58c7bb";

    if (status === "completed") backgroundColor = "#4fa89d";
    if (status === "cancelled") backgroundColor = "#e77f51";
    if (status === "confirmed") backgroundColor = "#f0a35d";

    return {
      style: {
        backgroundColor,
        borderRadius: "12px",
        opacity: 0.96,
        color: "white",
        border: "none",
        display: "block",
        boxShadow: "0 10px 22px rgba(15, 23, 42, 0.12)",
        padding: "0",
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

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleEventMouseEnter = useCallback((event: CalendarEvent, target: HTMLElement) => {
    clearHoverTimeout();

    const rect = target.getBoundingClientRect();
    const tooltipWidth = 320;
    const top = Math.min(rect.bottom + 12, window.innerHeight - 220);
    const left = Math.min(rect.left, window.innerWidth - tooltipWidth - 16);

    setHoveredEvent(event);
    setHoverPosition({
      top: Math.max(16, top),
      left: Math.max(16, left),
    });
  }, []);

  const handleEventMouseLeave = useCallback(() => {
    clearHoverTimeout();
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredEvent(null);
      setHoverPosition(null);
    }, 120);
  }, []);

  useEffect(() => {
    return () => clearHoverTimeout();
  }, []);

  const CalendarEventContent = ({ event }: { event: CalendarEvent }) => (
    <div
      className="calendar-event-chip"
      onMouseEnter={(e) => handleEventMouseEnter(event, e.currentTarget as HTMLDivElement)}
      onMouseLeave={handleEventMouseLeave}
    >
      <span className="calendar-event-time">{format(event.start, "HH:mm")}</span>
      <span className="calendar-event-title">{getEventTitle(event)}</span>
    </div>
  );

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
          <h1 className="text-3xl text-primary font-bold">Moj Kalendar</h1>
          <p className="text-muted-foreground">
            Pregled svih zakazanih termina
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary font-bold text-lg">
                <CalendarIcon className="w-5 h-5 text-primary" />
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
                    components={{
                      event: CalendarEventContent,
                      toolbar: (props: ToolbarProps<CalendarEvent, object>) => {
                        const { view, date, onNavigate, onView } = props;

                        const formatMonthLabel = (d: Date): string =>
                          new Intl.DateTimeFormat("hr", { month: "long", year: "numeric" }).format(d);

                        const formatDayLabel = (d: Date): string =>
                          `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

                        const getStartOfWeek = (d: Date): Date => {
                          const copy = new Date(d);
                          const day = (copy.getDay() + 6) % 7;
                          copy.setDate(copy.getDate() - day);
                          copy.setHours(0, 0, 0, 0);
                          return copy;
                        };

                        const getEndOfWeek = (d: Date): Date => {
                          const start = getStartOfWeek(d);
                          const end = new Date(start);
                          end.setDate(start.getDate() + 6);
                          return end;
                        };

                        const formatWeekLabel = (d: Date): string => {
                          const start = getStartOfWeek(d);
                          const end = getEndOfWeek(d);
                          return `${start.getDate()}-${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
                        };

                        const label: string =
                          view === "agenda"
                            ? ""
                            : view === "month"
                              ? formatMonthLabel(date)
                              : view === "week"
                                ? formatWeekLabel(date)
                                : formatDayLabel(date);

                        const ViewBtn = ({
                          v,
                          text,
                        }: {
                          v: View;
                          text: string;
                        }) => (
                          <button
                            type="button"
                            onClick={() => onView(v)}
                            className={[
                              "px-3 py-1 rounded border transition",
                              view === v ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                            ].join(" ")}
                          >
                            {text}
                          </button>
                        );

                        return (
                          <div className="flex items-center justify-between mb-3 gap-3">
                            <div className="flex gap-2">
                              <ViewBtn v="month" text="Mjesec" />
                              <ViewBtn v="week" text="Tjedan" />
                              <ViewBtn v="day" text="Dan" />
                              <ViewBtn v="agenda" text="Agenda" />
                            </div>

                            <div className="flex-1 text-center font-semibold">
                              {label}
                            </div>

                            <div className="flex gap-2">
                              <button type="button" className="px-3 py-1 rounded border hover:bg-muted transition" onClick={() => onNavigate("PREV")}>
                                <ChevronLeft />
                              </button>
                              <button type="button" className="px-3 py-1 rounded border hover:bg-muted transition" onClick={() => onNavigate("TODAY")}>
                                Danas
                              </button>
                              <button type="button" className="px-3 py-1 rounded border hover:bg-muted transition" onClick={() => onNavigate("NEXT")}>
                                <ChevronRight />
                              </button>
                            </div>

                          </div>
                        );
                      },
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
              <CardDescription
                className={`${
                  selectedEvent ? "pb-4 border-b-2" : ""
                }`}
              >
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
                      <span className="font-semibold">Psiholog</span>
                    </div>
                    <p className="text-sm">
                      {selectedEvent.resource.caretaker?.first_name}{" "}
                      {selectedEvent.resource.caretaker?.last_name}
                    </p>
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
                      {getStatusLabel(selectedEvent.resource.status)}
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
        </div>
      </div>

      {hoveredEvent && hoverPosition ? (
        <div
          className="fixed z-50 w-[320px] rounded-2xl border border-border bg-card/98 p-4 shadow-2xl supports-[backdrop-filter]:backdrop-blur-md"
          style={{ top: hoverPosition.top, left: hoverPosition.left }}
          onMouseEnter={clearHoverTimeout}
          onMouseLeave={handleEventMouseLeave}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Zakazani susret
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                {getEventTitle(hoveredEvent)}
              </h3>
            </div>
            <Badge variant="secondary">{getStatusLabel(hoveredEvent.resource.status)}</Badge>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-start gap-2 text-muted-foreground">
              <Clock className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-foreground">
                  {format(hoveredEvent.start, "PPP", { locale: hr })}
                </p>
                <p>
                  {format(hoveredEvent.start, "HH:mm")} - {format(hoveredEvent.end, "HH:mm")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-muted-foreground">
              <User className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-foreground">
                  {hoveredEvent.resource.caretaker.first_name} {hoveredEvent.resource.caretaker.last_name}
                </p>
                <p>Pogledaj profil ili detalje termina.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/carefree/caretaker/${hoveredEvent.resource.caretaker.user_id}`}>
                Profil psihologa
              </Link>
            </Button>
            {hoveredEvent.resource.conference_link ? (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => window.open(hoveredEvent.resource.conference_link, "_blank")}
              >
                <Video className="h-4 w-4" />
                Meet link
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
