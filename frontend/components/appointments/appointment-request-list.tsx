"use client";

import { useState } from "react";
import useSWR from "swr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { getCaretakerRequests } from "@/fetchers/appointments";
import { AppointmentRequestCard } from "./appointment-request-card";

export function AppointmentRequestList() {
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [flashMessage, setFlashMessage] = useState<{
    type: "success" | "warning";
    text: string;
  } | null>(null);

  // Dohvaćanje zahtjeva
  const { data: pendingRequests, error: pendingError, mutate: mutatePending } = useSWR(
    "appointments-pending",
    () => getCaretakerRequests("pending")
  );

  const { data: allRequests, error: allError, mutate: mutateAll } = useSWR(
    activeTab === "all" ? "appointments-all" : null,
    () => getCaretakerRequests()
  );

  const handleStatusChange = (result?: {
    action: "approved" | "rejected";
    request: { requested_start: string };
    appointment?: { conference_link?: string | null; status?: string };
  }) => {
    if (result) {
      const start = new Date(result.request.requested_start).toLocaleString("hr-HR", {
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      setFlashMessage(
        result.action === "approved"
          ? {
              type: "success",
              text: result.appointment?.conference_link
                ? `Zahtjev je prihvaćen za termin ${start}. Google Meet link je generiran i dostupan u kalendaru i detaljima zahtjeva.`
                : `Zahtjev je prihvaćen za termin ${start}. Detalji termina i Google Meet link prikazat će se u vašem kalendaru čim budu spremni.`,
            }
          : {
              type: "warning",
              text: `Zahtjev za termin ${start} je odbijen. Student sada može odabrati drugi termin.`,
            }
      );
    }
    mutatePending();
    mutateAll();
  };

  const isLoading = !pendingRequests && !pendingError;
  const requests = activeTab === "pending" ? pendingRequests : allRequests;
  const error = activeTab === "pending" ? pendingError : allError;

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "all")}>
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="pending" className="gap-2">
          Na čekanju
          {pendingRequests && pendingRequests.length > 0 && (
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {pendingRequests.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="all">Svi zahtjevi</TabsTrigger>
      </TabsList>

      <TabsContent value={activeTab} className="space-y-4 mt-6">
        {flashMessage && (
          <Card className={flashMessage.type === "success" ? "border-green-200 bg-green-50/80" : "border-amber-200 bg-amber-50/80"}>
            <CardContent className="flex items-start gap-3 p-4">
              {flashMessage.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-700" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 text-amber-700" />
              )}
              <p className={flashMessage.type === "success" ? "text-sm text-green-900" : "text-sm text-amber-900"}>
                {flashMessage.text}
              </p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50/70">
            <CardContent className="flex items-center gap-3 p-6">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-900">
                Greška pri učitavanju zahtjeva. Molimo osvježite stranicu.
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && !error && requests && requests.length === 0 && (
          <Card className="border-dashed border-primary/20 border-t-[3px] border-l-[3px] border-t-primary/22 border-l-primary/22 bg-[linear-gradient(180deg,rgba(231,244,241,0.2)_0%,rgba(255,255,255,1)_28%)]">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Inbox className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {activeTab === "pending" ? "Nema zahtjeva na čekanju" : "Nema zahtjeva"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {activeTab === "pending"
                  ? "Trenutno nemate novih zahtjeva za termine. Kada student pošalje zahtjev, vidjet ćete ga ovdje."
                  : "Još uvijek nemate nijedan zahtjev za termin."}
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && requests && requests.length > 0 && (
          <div className="space-y-4">
            {requests.map((request) => (
              <AppointmentRequestCard
                key={request.id}
                request={request}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
