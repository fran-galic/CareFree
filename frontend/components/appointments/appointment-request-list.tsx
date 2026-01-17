"use client";

import { useState } from "react";
import useSWR from "swr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, AlertCircle } from "lucide-react";
import { getCaretakerRequests } from "@/fetchers/appointments";
import { AppointmentRequestCard } from "./appointment-request-card";

export function AppointmentRequestList() {
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

  // Dohvaćanje zahtjeva
  const { data: pendingRequests, error: pendingError, mutate: mutatePending } = useSWR(
    "appointments-pending",
    () => getCaretakerRequests("pending")
  );

  const { data: allRequests, error: allError, mutate: mutateAll } = useSWR(
    activeTab === "all" ? "appointments-all" : null,
    () => getCaretakerRequests()
  );

  const handleStatusChange = () => {
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
        {error && (
          <Card className="border-red-200 bg-red-50/50">
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
          <Card className="border-dashed">
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
