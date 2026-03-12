"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View, ToolbarProps } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { hr } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, Video, User, Clock, ChevronLeft, ChevronRight, Info, AlertTriangle } from "lucide-react";
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

export default function AvailabilityPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    async function fetchData() {
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
    const student = event.resource.student;
    if (!student) {
      return "Student";
    }

    return `${student.first_name} ${student.last_name}`;
  }, []);

  const getEventDisplayTitle = useCallback((event: CalendarEvent) => {
    const student = event.resource.student;
    if (!student) {
      return "Student";
    }

    const firstName = (student.first_name || "").trim();
    const lastName = (student.last_name || "").trim();
    const shortName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
    const fullName = `${firstName} ${lastName}`.trim();

    if (view === "day" || view === "agenda") {
      return fullName || "Student";
    }

    return shortName || fullName || "Student";
  }, [view]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const status = event.resource.status;
    let backgroundColor = "#2f7f73";

    if (status === "confirmed") backgroundColor = "#245f54";
    if (status === "confirmed_pending_sync") backgroundColor = "#b78945";
    if (status === "confirmed_sync_failed") backgroundColor = "#a45344";
    if (status === "completed") backgroundColor = "#5c9f94";
    if (status === "cancelled") backgroundColor = "#c7644a";

    return {
      style: {
        backgroundColor,
        borderRadius: "10px",
        opacity: 0.96,
        color: "white",
        border: "none",
        display: "block",
        boxShadow: "0 10px 18px rgba(15, 23, 42, 0.10)",
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

  const CalendarEventContent = ({ event }: { event: CalendarEvent }) => (
    <div
      className={`calendar-event-chip calendar-event-chip--${view}`}
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
            Pregled svih zakazanih termina unutar CareFree sustava
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-border/80 border-t-[3px] border-l-[3px] border-t-primary/28 border-l-primary/28 bg-[linear-gradient(180deg,rgba(231,244,241,0.22)_0%,rgba(255,255,255,1)_24%)]">
            <CardHeader>
              <CardTitle className="flex items-center text-lg gap-2">
                <CalendarIcon className="w-5 h-5" />
                Kalendar termina
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(250,253,252,1)_0%,rgba(255,255,255,1)_100%)] p-4" style={{ height: "600px" }}>
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
                          <div>Student</div>
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
          <Card className="border-border/80 border-t-[3px] border-l-[3px] border-t-primary/22 border-l-primary/22 bg-[linear-gradient(180deg,rgba(231,244,241,0.16)_0%,rgba(255,255,255,1)_30%)]">
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
                          : selectedEvent.resource.status === "confirmed_sync_failed"
                          ? "outline"
                          : "secondary"
                      }
                    >
                      {selectedEvent.resource.status === "confirmed" && "Potvrđeno"}
                      {selectedEvent.resource.status === "completed" && "Završeno"}
                      {selectedEvent.resource.status === "cancelled" && "Otkazano"}
                      {selectedEvent.resource.status === "confirmed_pending_sync" && "Potvrda u tijeku"}
                      {selectedEvent.resource.status === "confirmed_sync_failed" && "Potvrđeno bez Meet linka"}
                    </Badge>
                  </div>

                  {selectedEvent.resource.status === "confirmed_pending_sync" && !selectedEvent.resource.conference_link && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-4 w-4 text-amber-700" />
                        <div>
                          <p className="text-sm font-medium text-amber-900">Google Meet link se priprema</p>
                          <p className="mt-1 text-sm text-amber-800">
                            Termin je potvrđen, a Meet link će se pojaviti ovdje čim sinkronizacija završi.
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
                            Termin postoji u kalendaru, ali Google Meet link nije uspješno spremljen.
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

          <Card className="mt-6 border-border/80 border-t-[3px] border-l-[3px] border-t-primary/22 border-l-primary/22 bg-[linear-gradient(180deg,rgba(231,244,241,0.16)_0%,rgba(255,255,255,1)_30%)]">
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
                <span className="font-semibold text-primary">
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
                <span className="font-semibold text-[#4b9f92]">
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
