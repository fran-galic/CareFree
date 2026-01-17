"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarCheck, Bell } from "lucide-react";
import Link from "next/link";
import { AppointmentRequestList } from "@/components/appointments/appointment-request-list";

export default function RequestsPage() {
  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
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
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Automatske email notifikacije
            </p>
            <p className="text-blue-700 dark:text-blue-300 mt-1">
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
