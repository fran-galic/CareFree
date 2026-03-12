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
import { Loader2, Calendar as CalendarIcon, Video, User, Clock, ChevronLeft, ChevronRight, Info, AlertTriangle } from "lucide-react";
import { getMyAppointments, type Appointment } from "@/fetchers/appointments";
import { Button } from "@/components/ui/button";
const SEEN_APPOINTMENTS_KEY = "carefree-seen-appointment-ids";

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

interface CalendarToolbarProps {
  view: View;
  date: Date;
  onNavigate: (action: any) => void;
  onView: (view: View) => void;
}

function getStartOfWeekDate(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getEndOfWeekDate(d: Date): Date {
  const end = new Date(getStartOfWeekDate(d));
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatToolbarMonthLabel(d: Date): string {
  return new Intl.DateTimeFormat("hr", { month: "long", year: "numeric" }).format(d);
}

function formatToolbarDayLabel(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatToolbarWeekLabel(d: Date): string {
  const start = getStartOfWeekDate(d);
  const end = getEndOfWeekDate(d);
  return `${start.getDate()}-${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
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
    if (typeof window === "undefined" || appointments.length === 0) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(SEEN_APPOINTMENTS_KEY);
      const parsed = raw ? (JSON.parse(raw) as number[]) : [];
      const current = new Set(Array.isArray(parsed) ? parsed : []);
      appointments.forEach((appointment) => current.add(appointment.id));
      window.localStorage.setItem(SEEN_APPOINTMENTS_KEY, JSON.stringify([...current]));
    } catch {
      // Best effort only.
    }
  }, [appointments]);

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

  const agendaEvents = useMemo(() => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    end.setHours(23, 59, 59, 999);

    return events
      .filter((event) => event.start >= start && event.start <= end)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [date, events]);

  const getEventTitle = useCallback((event: CalendarEvent) => {
    const caretaker = event.resource.caretaker;
    if (!caretaker) {
      return "Termin";
    }

    return `${caretaker.first_name} ${caretaker.last_name}`;
  }, []);

  const getEventDisplayTitle = useCallback((event: CalendarEvent) => {
    const caretaker = event.resource.caretaker;
    if (!caretaker) {
      return "Termin";
    }

    const firstName = (caretaker.first_name || "").trim();
    const lastName = (caretaker.last_name || "").trim();
    const shortName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
    const fullName = `${firstName} ${lastName}`.trim();

    if (view === "month") {
      return shortName || fullName || "Termin";
    }

    if (view === "day") {
      return shortName || fullName || "Termin";
    }

    if (view === "week") {
      return shortName || fullName || "Termin";
    }

    if (view === "agenda") {
      return fullName || "Termin";
    }

    return fullName || "Termin";
  }, [view]);

  const getStatusLabel = useCallback((status: string) => {
    if (status === "confirmed") return "Potvrđeno";
    if (status === "completed") return "Završeno";
    if (status === "cancelled") return "Otkazano";
    if (status === "confirmed_pending_sync") return "Potvrda u tijeku";
    if (status === "confirmed_sync_failed") return "Potvrđeno bez Meet linka";
    return "Zakazano";
  }, []);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const status = event.resource.status;
    let backgroundColor = "#6bb5a8";

    if (status === "completed") backgroundColor = "#5b9f94";
    if (status === "cancelled") backgroundColor = "#cf7658";
    if (status === "confirmed") backgroundColor = "#4f9f92";
    if (status === "confirmed_pending_sync") backgroundColor = "#c79a57";
    if (status === "confirmed_sync_failed") backgroundColor = "#b56454";

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

  const handleAgendaNavigate = useCallback((action: any) => {
    if (action === "TODAY") {
      setDate(new Date());
      return;
    }

    if (action !== "PREV" && action !== "NEXT") {
      return;
    }

    setDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + (action === "NEXT" ? 30 : -30));
      return next;
    });
  }, []);

  const CalendarToolbar = ({ view, date, onNavigate, onView }: CalendarToolbarProps) => {
    const label: string =
      view === "agenda"
        ? "Agenda termina"
        : view === "month"
          ? formatToolbarMonthLabel(date)
          : view === "week"
            ? formatToolbarWeekLabel(date)
            : formatToolbarDayLabel(date);

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
      <div className="mb-3 flex items-center justify-between gap-3">
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
  };

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
      className={`calendar-event-chip calendar-event-chip--${view}`}
      onMouseEnter={(e) => handleEventMouseEnter(event, e.currentTarget as HTMLDivElement)}
      onMouseLeave={handleEventMouseLeave}
      title={getEventTitle(event)}
    >
      <span className={`calendar-event-title calendar-event-title--${view}`}>{getEventDisplayTitle(event)}</span>
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
                {view === "agenda" ? (
                  <div className="flex h-full flex-col">
                    <CalendarToolbar
                      view={view}
                      date={date}
                      onNavigate={handleAgendaNavigate}
                      onView={handleViewChange}
                    />
                    <div className="flex-1 overflow-auto rounded-2xl border border-border">
                      {agendaEvents.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          Nema termina u ovom periodu.
                        </div>
                      ) : (
                        <div className="grid grid-cols-[1.05fr_0.8fr_1.4fr] border-b border-border/80 bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <div>Datum</div>
                          <div>Vrijeme</div>
                          <div>Psiholog</div>
                        </div>
                      )}
                      {agendaEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => handleSelectEvent(event)}
                          className="grid w-full grid-cols-[1.05fr_0.8fr_1.4fr] items-center gap-3 border-b border-border/70 px-4 py-4 text-left transition hover:bg-primary/5"
                        >
                          <div className="text-sm font-medium text-foreground">
                            {format(event.start, "dd.MM.yyyy", { locale: hr })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(event.start, "HH:mm")} - {format(event.end, "HH:mm")}
                          </div>
                          <div className="min-w-0 text-sm font-semibold text-foreground">
                            <span className="block truncate">{getEventTitle(event)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Calendar
                    localizer={localizer}
                    events={events}
                    titleAccessor={(event) => getEventDisplayTitle(event as CalendarEvent)}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: "100%" }}
                    view={view}
                    onView={handleViewChange}
                    date={date}
                    onNavigate={handleNavigate}
                    onSelectEvent={handleSelectEvent}
                    popup
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
                      toolbar: (props: ToolbarProps<CalendarEvent, object>) => (
                        <CalendarToolbar
                          view={props.view}
                          date={props.date}
                          onNavigate={props.onNavigate}
                          onView={props.onView}
                        />
                      ),
                    }}
                    culture="hr"
                  />
                )}
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
                          : selectedEvent.resource.status === "confirmed_sync_failed"
                          ? "outline"
                          : "secondary"
                      }
                    >
                      {getStatusLabel(selectedEvent.resource.status)}
                    </Badge>
                  </div>

                  {selectedEvent.resource.status === "confirmed_pending_sync" && !selectedEvent.resource.conference_link && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-4 w-4 text-amber-700" />
                        <div>
                          <p className="text-sm font-medium text-amber-900">Google Meet link se priprema</p>
                          <p className="mt-1 text-sm text-amber-800">
                            Psiholog je prihvatio zahtjev. Meet link će se pojaviti ovdje čim Google Calendar sinkronizacija završi.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedEvent.resource.status === "confirmed_sync_failed" && !selectedEvent.resource.conference_link && (
                    <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700" />
                        <div>
                          <p className="text-sm font-medium text-red-900">Meet link trenutno nije dostupan</p>
                          <p className="mt-1 text-sm text-red-800">
                            Termin je potvrđen, ali Google Meet link nije uspješno spremljen. Provjerite e-mail ili pokušajte ponovno kasnije.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedEvent.resource.conference_link && (
                    <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Google Meet</p>
                        <p className="mt-1 break-all text-sm text-foreground">
                          {selectedEvent.resource.conference_link}
                        </p>
                      </div>
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
