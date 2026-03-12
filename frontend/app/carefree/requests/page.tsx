"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarCheck, Bell } from "lucide-react";
import Link from "next/link";
import { AppointmentRequestList } from "@/components/appointments/appointment-request-list";

export default function RequestsPage() {
  return (
    <div className="container mx-auto max-w-5xl space-y-5 px-6 pt-3 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/carefree/main">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
              <CalendarCheck className="w-8 h-8" />
              Zahtjevi studenata
            </h1>
            <p className="text-muted-foreground mt-1">
              Pregledajte i upravljajte zahtjevima za rezervaciju termina
            </p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-[#eadfc3] bg-[linear-gradient(180deg,rgba(251,246,236,0.96)_0%,rgba(255,255,255,0.98)_100%)] p-4">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 text-[#b7791f]" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-[#6b4f1d]">
              Automatske email notifikacije
            </p>
            <p className="mt-1 text-[#8a7448]">
              Kada student pošalje zahtjev, automatski ćete dobiti email obavijest. 
              Nakon što prihvatite termin, student će dobiti email s potvrdom i Google Meet linkom.
            </p>
          </div>
        </div>
      </div>

      {/* Lista zahtjeva */}
      <AppointmentRequestList />
    </div>
  );
}
