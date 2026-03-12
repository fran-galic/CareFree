"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View, ToolbarProps } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { hr } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, Video, User, Clock, ChevronLeft, ChevronRight } from "lucide-react";
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

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const status = event.resource.status;
    let backgroundColor = "#2f7f73";

    if (status === "completed") backgroundColor = "#4b9f92";
    if (status === "cancelled") backgroundColor = "#ef4444"; // red
    if (status === "confirmed") backgroundColor = "#21423d";

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
                              view === v ? "bg-primary text-primary-foreground border-primary" : "hover:bg-secondary",
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
                              <button type="button" className="rounded border border-border px-3 py-1 transition hover:bg-secondary" onClick={() => onNavigate("PREV")}>
                                <ChevronLeft />
                              </button>
                              <button type="button" className="rounded border border-border px-3 py-1 transition hover:bg-secondary" onClick={() => onNavigate("TODAY")}>
                                Danas
                              </button>
                              <button type="button" className="rounded border border-border px-3 py-1 transition hover:bg-secondary" onClick={() => onNavigate("NEXT")}>
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
