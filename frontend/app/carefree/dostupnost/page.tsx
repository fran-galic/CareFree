"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, Save, RefreshCw, Info } from "lucide-react";
import { format, addDays, startOfDay, setHours, isSameDay, parseISO } from "date-fns";
import { hr } from "date-fns/locale";

interface AvailabilitySlot {
  start: string;
  end: string;
  is_available: boolean;
  has_appointment: boolean;
}

interface GridSlot {
  date: Date;
  hour: number;
  isAvailable: boolean;
  hasAppointment: boolean;
  isChanged: boolean;
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8-18 (8:00-17:00, last slot ends at 18:00)
const DAYS_TO_SHOW = 7;

export default function DostupnostPage() {
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [gridSlots, setGridSlots] = useState<GridSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const days = Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(startOfDay(new Date()), i));

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/appointments/caretaker/availability/my/?days=${DAYS_TO_SHOW}`,
        { credentials: "include" }
      );

      if (response.ok) {
        const data: AvailabilitySlot[] = await response.json();
        setAvailabilitySlots(data);
        initializeGrid(data);
      } else {
        console.error("Greška pri dohvaćanju dostupnosti");
      }
    } catch (error) {
      console.error("Greška:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeGrid = (slots: AvailabilitySlot[]) => {
    const grid: GridSlot[] = [];

    days.forEach((day) => {
      HOURS.forEach((hour) => {
        const slotDate = setHours(day, hour);
        const existing = slots.find((s) => {
          const slotStart = parseISO(s.start);
          return isSameDay(slotStart, slotDate) && slotStart.getHours() === hour;
        });

        grid.push({
          date: slotDate,
          hour,
          isAvailable: existing?.is_available || false,
          hasAppointment: existing?.has_appointment || false,
          isChanged: false,
        });
      });
    });

    setGridSlots(grid);
    setHasChanges(false);
  };

  const toggleSlot = (date: Date, hour: number) => {
    setGridSlots((prev) =>
      prev.map((slot) => {
        if (isSameDay(slot.date, date) && slot.hour === hour) {
          // Ne možemo mijenjati slotove sa zakazanim appointmentima
          if (slot.hasAppointment) {
            return slot;
          }
          return {
            ...slot,
            isAvailable: !slot.isAvailable,
            isChanged: true,
          };
        }
        return slot;
      })
    );
    setHasChanges(true);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const changedSlots = gridSlots
        .filter((s) => s.isChanged)
        .map((s) => ({
          slot: s.date.toISOString(),
          is_available: s.isAvailable,
        }));

      if (changedSlots.length === 0) {
        setSaving(false);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/appointments/caretaker/availability/save/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ slots: changedSlots }),
        }
      );

      if (response.ok) {
        // Refresh data
        await fetchAvailability();
        alert("Dostupnost uspješno spremljena!");
      } else {
        const error = await response.json();
        alert(`Greška: ${error.detail || "Neuspješno spremanje"}`);
      }
    } catch (error) {
      console.error("Greška pri spremanju:", error);
      alert("Greška pri spremanju dostupnosti");
    } finally {
      setSaving(false);
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
          <h1 className="text-3xl text-primary font-bold">Dostupnost</h1>
          <p className="text-muted-foreground">
            Postavite svoju dostupnost za sljedećih 7 dana
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAvailability} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Osvježi
          </Button>
          <Button
            onClick={saveChanges}
            disabled={!hasChanges || saving}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Spremam...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Spremi promjene
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Postavi dostupnost po terminima
          </CardTitle>
          <CardDescription>
            Kliknite na vrijeme da označite kada ste dostupni. Zeleno = dostupan, Sivo = nedostupan, Plavo = zakazan termin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-lg border p-4">
            {/* Info Box */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Kako postaviti dostupnost:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Kliknite na slobodne satnice da ih označite kao dostupne (zeleno)</li>
                  <li>Kliknite ponovno da poništite dostupnost (sivo)</li>
                  <li>Plave satnice imaju zakazan termin i ne mogu se mijenjati</li>
                  <li>Promjene se spremaju tek kada kliknete &quot;Spremi promjene&quot;</li>
                </ul>
              </div>
            </div>

            {/* Legend */}
            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Dostupan</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded"></div>
                <span>Nedostupan</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>Zakazan termin</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-300 rounded border-2 border-yellow-500"></div>
                <span>Izmijenjeno (nespremljeno)</span>
              </div>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Header Row */}
                <div className="grid grid-cols-8 gap-1 mb-2">
                  <div className="font-medium text-sm text-center py-2">Vrijeme</div>
                  {days.map((day, idx) => (
                    <div key={idx} className="font-medium text-sm text-center py-2">
                      <div>{format(day, "EEEE", { locale: hr })}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(day, "d.M.", { locale: hr })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Time Slots */}
                {HOURS.map((hour) => (
                  <div key={hour} className="grid grid-cols-8 gap-1 mb-1">
                    <div className="text-sm text-center py-3 font-medium">
                      {hour}:00
                    </div>
                    {days.map((day, dayIdx) => {
                      const slot = gridSlots.find(
                        (s) => isSameDay(s.date, day) && s.hour === hour
                      );

                      if (!slot) return <div key={dayIdx} className="h-12" />;

                      const isPast = slot.date < new Date();
                      const bgColor = slot.hasAppointment
                        ? "bg-blue-500 text-white cursor-not-allowed"
                        : slot.isAvailable
                          ? slot.isChanged
                            ? "bg-green-400 border-2 border-yellow-500"
                            : "bg-green-500 text-white"
                          : slot.isChanged
                            ? "bg-gray-100 border-2 border-yellow-500"
                            : "bg-gray-200";

                      return (
                        <button
                          key={dayIdx}
                          onClick={() => !slot.hasAppointment && !isPast && toggleSlot(day, hour)}
                          disabled={slot.hasAppointment || isPast}
                          className={`h-12 rounded-md transition-all hover:opacity-80 ${bgColor} ${
                            isPast ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          title={
                            slot.hasAppointment
                              ? "Zakazan termin"
                              : isPast
                                ? "Prošlo vrijeme"
                                : slot.isAvailable
                                  ? "Dostupan - klikni za promjenu"
                                  : "Nedostupan - klikni za dostupnost"
                          }
                        >
                          {slot.hasAppointment && (
                            <Badge variant="secondary" className="text-xs bg-white/20">
                              Zauzeto
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Napomena</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Studenti mogu rezervirati termine samo za vrijeme koje ste označili kao dostupno.
          </p>
          <p>
            Postavite svoju dostupnost barem nekoliko dana unaprijed kako bi studenti mogli lakše rezervirati termine.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
