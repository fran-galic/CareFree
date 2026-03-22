"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/fetchers/fetcher";
import { useEffect, useMemo, useState } from "react";
import {
  getPendingAppointmentFeedback,
  getStudentRequests,
  submitAppointmentFeedback,
  type AppointmentRequest,
  type Appointment,
} from "@/fetchers/appointments";
import { readSessionCache, writeSessionCache } from "@/lib/session-cache";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageCircle, 
  BookOpen, 
  CalendarDays, 
  Search, 
  ArrowRight, 
  ChevronUp,
  Video,
  Clock3,
  CheckCircle2,
  AlertCircle,
  HeartHandshake
} from "lucide-react";

const BACKEND_API = process.env.NEXT_PUBLIC_BACKEND_URL;
const SEEN_APPOINTMENTS_KEY = "carefree-seen-appointment-ids";
const STUDENT_APPOINTMENTS_CACHE_KEY = "carefree:student-dashboard:appointments";
const STUDENT_REQUESTS_CACHE_KEY = "carefree:student-dashboard:requests";
const STUDENT_PENDING_FEEDBACK_CACHE_KEY = "carefree:student-dashboard:pending-feedback";
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

interface StudentDashboardProps {
  firstName: string;
}

const FEEDBACK_OPTIONS = [
  { value: "calmer", label: "Osjećam se mirnije" },
  { value: "helped", label: "Razgovor mi je pomogao" },
  { value: "clearer", label: "Dobio/la sam više jasnoće" },
  { value: "processing", label: "Još razmišljam o svemu" },
] as const;

function readSeenAppointmentIds(): number[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SEEN_APPOINTMENTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as number[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markAppointmentAsSeen(appointmentId: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current = new Set(readSeenAppointmentIds());
    current.add(appointmentId);
    window.localStorage.setItem(SEEN_APPOINTMENTS_KEY, JSON.stringify([...current]));
  } catch {
    // Best effort only.
  }
}

export function StudentDashboard({ firstName }: StudentDashboardProps) {
  const router = useRouter();
  const [isAppointmentExpanded, setIsAppointmentExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'appointments' | 'requests'>('appointments');
  const [dashboardNow] = useState(() => Date.now());
  const [cachedAppointments] = useState<Appointment[]>(() => readSessionCache<Appointment[]>(STUDENT_APPOINTMENTS_CACHE_KEY) ?? []);
  const [cachedRequests] = useState<AppointmentRequest[]>(() => readSessionCache<AppointmentRequest[]>(STUDENT_REQUESTS_CACHE_KEY) ?? []);
  const [cachedPendingFeedback] = useState<{ appointment: Appointment | null } | null>(
    () => readSessionCache<{ appointment: Appointment | null }>(STUDENT_PENDING_FEEDBACK_CACHE_KEY)
  );

  // Dohvat termina sa caretakerima
  const { data: appointments, isLoading: appointmentsLoading } = useSWR<Appointment[]>(
    `${BACKEND_API}/api/appointments/`,
    fetcher,
    {
      fallbackData: cachedAppointments,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5 * 60 * 1000,
    }
  );

  const { data: requests, isLoading: requestsLoading } = useSWR<AppointmentRequest[]>(
    "student-requests",
    () => getStudentRequests(),
    {
      fallbackData: cachedRequests,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5 * 60 * 1000,
    }
  );
  const {
    data: pendingFeedbackData,
    isLoading: pendingFeedbackLoading,
    mutate: mutatePendingFeedback,
  } = useSWR(
    "student-pending-feedback",
    getPendingAppointmentFeedback,
    {
      fallbackData: cachedPendingFeedback ?? undefined,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5 * 60 * 1000,
    }
  );

  useEffect(() => {
    if (appointments) {
      writeSessionCache(STUDENT_APPOINTMENTS_CACHE_KEY, appointments, DASHBOARD_CACHE_TTL_MS);
    }
  }, [appointments]);

  useEffect(() => {
    if (requests) {
      writeSessionCache(STUDENT_REQUESTS_CACHE_KEY, requests, DASHBOARD_CACHE_TTL_MS);
    }
  }, [requests]);

  useEffect(() => {
    if (pendingFeedbackData) {
      writeSessionCache(STUDENT_PENDING_FEEDBACK_CACHE_KEY, pendingFeedbackData, DASHBOARD_CACHE_TTL_MS);
    }
  }, [pendingFeedbackData]);

  const upcomingAppointments = useMemo(() => {
    return (appointments ?? []).filter((appointment) => new Date(appointment.end).getTime() > dashboardNow);
  }, [appointments, dashboardNow]);

  const itemToShow = upcomingAppointments[0];
  const latestRequest = requests?.[0];
  const isLoading = appointmentsLoading;
  const pendingFeedbackAppointment = pendingFeedbackData?.appointment ?? null;
  const [selectedFeedbackResponse, setSelectedFeedbackResponse] = useState<(typeof FEEDBACK_OPTIONS)[number]["value"] | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    router.prefetch("/carefree/messages");
    router.prefetch("/carefree/search");
    router.prefetch("/carefree/calendar");
    router.prefetch("/carefree/journal");
  }, [router]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("hr-HR", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  };

  const getRequestStatusCopy = (request: AppointmentRequest) => {
    const caretakerName = `${request.caretaker?.first_name ?? ""} ${request.caretaker?.last_name ?? ""}`.trim();
    const slot = formatDate(request.requested_start);
    const requestEnd = new Date(request.requested_end).getTime();

    if (requestEnd <= dashboardNow) {
      return null;
    }

    if (request.status === "pending") {
      return {
        title: "Čeka se potvrda psihologa",
        body: `${caretakerName} još nije odgovorio/la na vaš zahtjev za termin ${slot}.`,
        tone: "warning" as const,
      };
    }

    if (request.status === "accepted") {
      const appointmentId = request.appointment_id;
      const isSeen = appointmentId ? readSeenAppointmentIds().includes(appointmentId) : false;

      if (isSeen) {
        return null;
      }

      if (request.appointment_status === "confirmed_pending_sync") {
        return {
          title: "Termin je prihvaćen",
          body: `Psiholog je prihvatio zahtjev za ${slot}. Google Meet link se upravo priprema i uskoro će biti vidljiv u kalendaru.`,
          tone: "success" as const,
        };
      }

      if (request.appointment_status === "confirmed_sync_failed") {
        return {
          title: "Termin je potvrđen",
          body: `Psiholog je prihvatio zahtjev za ${slot}. Termin je vidljiv u kalendaru, ali Google Meet link trenutno nije generiran.`,
          tone: "warning" as const,
        };
      }

      return {
        title: "Termin je potvrđen",
        body: `Psiholog je prihvatio zahtjev za ${slot}. Detalje i Meet link možete otvoriti u kalendaru.`,
        tone: "success" as const,
      };
    }

    if (request.status === "rejected") {
      return {
        title: "Zahtjev nije prihvaćen",
        body: `Za termin ${slot} psiholog trenutno nije dostupan. Možete odabrati drugi termin.`,
        tone: "error" as const,
      };
    }

    return null;
  };

  const latestRequestCopy = latestRequest ? getRequestStatusCopy(latestRequest) : null;

  const handleDismissFeedback = async () => {
    if (!pendingFeedbackAppointment || isSubmittingFeedback) {
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      await submitAppointmentFeedback(pendingFeedbackAppointment.id, { status: "dismissed" });
      setSelectedFeedbackResponse(null);
      setFeedbackComment("");
      await mutatePendingFeedback({ appointment: null }, false);
      writeSessionCache(STUDENT_PENDING_FEEDBACK_CACHE_KEY, { appointment: null }, DASHBOARD_CACHE_TTL_MS);
    } catch (error) {
      console.error("Greška pri spremanju odluke o feedbacku:", error);
      alert("Greška pri spremanju odluke. Pokušajte ponovno.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!pendingFeedbackAppointment || !selectedFeedbackResponse || isSubmittingFeedback) {
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      await submitAppointmentFeedback(pendingFeedbackAppointment.id, {
        status: "submitted",
        selected_response: selectedFeedbackResponse,
        comment: feedbackComment.trim(),
      });
      setSelectedFeedbackResponse(null);
      setFeedbackComment("");
      await mutatePendingFeedback({ appointment: null }, false);
      writeSessionCache(STUDENT_PENDING_FEEDBACK_CACHE_KEY, { appointment: null }, DASHBOARD_CACHE_TTL_MS);
    } catch (error) {
      console.error("Greška pri slanju feedbacka:", error);
      alert("Greška pri slanju povratne informacije. Pokušajte ponovno.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-8 p-6 pb-16 animate-in fade-in duration-500">
      
      {/* 1. POZDRAVNA SEKCIJA */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">
          Bok, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground text-lg">
          Dobrodošao/la u svoj sigurni kutak. Kako ti možemo pomoći danas?
        </p>
      </div>

      {latestRequestCopy && !requestsLoading && (
        <Card
          className={
            latestRequestCopy.tone === "success"
              ? "border-primary/20 bg-primary/10"
              : latestRequestCopy.tone === "error"
                ? "border-red-200 bg-red-50/80"
                : "border-[#eadfc3] bg-[linear-gradient(180deg,rgba(251,246,236,0.96)_0%,rgba(255,255,255,0.98)_100%)]"
          }
        >
          <CardContent className="flex items-start gap-3 p-4">
            {latestRequestCopy.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            ) : latestRequestCopy.tone === "error" ? (
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-700" />
            ) : (
              <Clock3 className="mt-0.5 h-5 w-5 text-[#b7791f]" />
            )}
            <div className="space-y-1">
              <p className={`font-medium ${
                latestRequestCopy.tone === "success"
                  ? "text-primary"
                  : latestRequestCopy.tone === "error"
                    ? "text-red-900"
                    : "text-[#6b4f1d]"
              }`}>
                {latestRequestCopy.title}
              </p>
              <p className={`text-sm ${
                latestRequestCopy.tone === "success"
                  ? "text-foreground/80"
                  : latestRequestCopy.tone === "error"
                    ? "text-red-800"
                    : "text-[#8a7448]"
              }`}>
                {latestRequestCopy.body}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!pendingFeedbackLoading && pendingFeedbackAppointment && (
        <Card className="border-primary/20 bg-[linear-gradient(180deg,rgba(231,244,241,0.22)_0%,rgba(255,255,255,1)_100%)]">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <HeartHandshake className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="font-medium text-primary">Kako ti je sjeo razgovor?</p>
                <p className="text-sm text-muted-foreground">
                  Ako želiš, ostavi kratku povratnu informaciju o tome kako si se osjećao/la nakon susreta. To može pomoći psihologu da bolje razumije kako ti je razgovor koristio.
                </p>
                <p className="text-xs text-muted-foreground">
                  Razgovor: {pendingFeedbackAppointment.caretaker?.first_name} {pendingFeedbackAppointment.caretaker?.last_name} · {formatDate(pendingFeedbackAppointment.start)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {FEEDBACK_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedFeedbackResponse(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    selectedFeedbackResponse === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/35 hover:bg-primary/5"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Možeš napisati što ti je bilo korisno ili kako si se osjećao/la nakon razgovora.
              </label>
              <Textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={4}
                placeholder="Npr. osjećam se smirenije, bilo mi je korisno što sam dobio/la jasniji pogled na situaciju..."
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="sm:flex-1"
                disabled={!selectedFeedbackResponse || isSubmittingFeedback}
                onClick={handleSubmitFeedback}
              >
                {isSubmittingFeedback ? "Spremam..." : "Pošalji povratnu informaciju"}
              </Button>
              <Button
                variant="outline"
                className="sm:flex-1"
                disabled={isSubmittingFeedback}
                onClick={handleDismissFeedback}
              >
                Preskoči za sada
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:auto-rows-[23rem]">
        
        {/* 2. GLAVNA KARTICA: AI CHAT */}
        <Card className="md:col-span-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 shadow-md hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => router.push("/carefree/messages")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl text-primary">
              <MessageCircle className="w-8 h-8" />
              Julija - CareFree AI asistent
            </CardTitle>
            <CardDescription className="text-base">
              Tvoj anonimni sugovornik dostupan 24/7.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium text-foreground/80 leading-relaxed">
              "Osjećaš se preplavljeno ili samo trebaš nekoga za razgovor? 
              Ovdje sam da te saslušam bez osude."
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full sm:w-auto gap-2 group-hover:bg-primary/90">
              Započni razgovor <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardFooter>
        </Card>

        {/* 3. DESNI STUPAC: QUICK ACTIONS */}
        <div className="flex flex-col gap-6">
          
          {/* STATUS TERMINA / PSIHOLOG */}
          <Card className={`flex flex-col h-full border-l-4 border-l-primary transition-all duration-500 ${
            !isAppointmentExpanded ? 'cursor-pointer hover:bg-accent/5' : ''
          }`}
                onClick={() => {
                  if (isAppointmentExpanded) {
                    return;
                  }

                  if (itemToShow) {
                    setIsAppointmentExpanded(true);
                    setSelectedTab('appointments');
                    return;
                  }

                  router.push("/carefree/search");
                }}>
            <CardHeader className="pb-0 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="w-5 h-5 text-primary" />
                Sljedeći termin
              </CardTitle>
              {isAppointmentExpanded && itemToShow && (
                <button
                  onClick={() => setIsAppointmentExpanded(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <ChevronUp />
                </button>
              )}
            </CardHeader>
            {isAppointmentExpanded && (
              <div className="px-6 pt-2 pb-2 flex gap-2 border-b bg-background animate-in fade-in slide-in-from-top-2 duration-500">
                <button
                  onClick={() => setSelectedTab('appointments')}
                  className={`text-sm font-medium pb-2 px-2 transition-colors ${
                    selectedTab === 'appointments'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Moji termini
                </button>
                <button
                  onClick={() => setSelectedTab('requests')}
                  className={`text-sm font-medium pb-2 px-2 transition-colors ${
                    selectedTab === 'requests'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Poslani zahtjevi
                </button>
              </div>
            )}
            <CardContent className="pt-2 transition-all duration-500 flex flex-col gap-2 overflow-hidden min-h-0">
              {!isAppointmentExpanded ? (
                <>
                  {isLoading ? (
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : !itemToShow ? (
                    latestRequest && latestRequest.status === "pending" ? (
                      <div className="border-l-2 border-amber-300 space-y-2 py-2">
                        <p className="px-3 text-sm font-medium text-foreground">
                          {latestRequest.caretaker?.first_name} {latestRequest.caretaker?.last_name}
                        </p>
                        <p className="px-3 text-xs text-muted-foreground">
                          Zahtjev poslan za {formatDate(latestRequest.requested_start)}
                        </p>
                        <p className="px-3 text-xs text-amber-700">
                          Čeka se potvrda psihologa.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground text-sm mb-3">Nemaš zakazanih termina.</p>
                        <Link href="/carefree/search">
                          <Button variant="outline" size="sm" className="w-full gap-2 border-dashed">
                            <Search className="w-4 h-4" /> Pronađi CareTakera
                          </Button>
                        </Link>
                      </div>
                    )
                  ) : (
                    <div className="border-l-2 border-primary/30 space-y-2 py-2">
                      <p className="text-sm font-medium text-foreground px-3">
                        {itemToShow.caretaker?.first_name} {itemToShow.caretaker?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground px-3">
                        {formatDate(itemToShow.start)}
                      </p>
                    </div>
                  )}
                </>
              ) : selectedTab === "appointments" ? (
                <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      ))}
                    </div>
                  ) : upcomingAppointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nemaš zakazanih termina.
                    </p>
                  ) : (
                    <div className="space-y-3 mr-4">
                      {upcomingAppointments.map((apt) => (
                        <div key={apt.id} className="border-l-2 border-primary/30 pl-3 py-2 flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {apt.caretaker?.first_name} {apt.caretaker?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(apt.start)}
                            </p>
                          </div>
                          {apt.status && apt.status !== "confirmed_pending_sync" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAppointmentAsSeen(apt.id);
                                router.push(`/carefree/calendar?appointment=${apt.id}`);
                              }}
                              className="p-1.5 bg-primary hover:bg-primary/90 rounded-md transition-colors"
                              title="Otvori u kalendaru"
                            >
                              <Video className="w-5 h-5 text-accent-foreground" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                  {requestsLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      ))}
                    </div>
                  ) : !requests || requests.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">Nema poslanih zahtjeva.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mr-4">
                      {requests.map((request) => (
                        <div key={request.id} className="rounded-xl border border-border/70 bg-background/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {request.caretaker?.first_name} {request.caretaker?.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(request.requested_start)}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                request.status === "accepted"
                                  ? "bg-green-100 text-green-800"
                                  : request.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {request.status === "accepted"
                                ? "Prihvaćen"
                                : request.status === "rejected"
                                  ? "Odbijen"
                                  : "Na čekanju"}
                            </span>
                          </div>
                          {request.status === "accepted" && request.appointment_id ? (
                            <div className="mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-2"
                                onClick={() => {
                                  if (request.appointment_id) {
                                    markAppointmentAsSeen(request.appointment_id);
                                  }
                                  router.push(`/carefree/calendar?appointment=${request.appointment_id}`);
                                }}
                              >
                                <CalendarDays className="w-4 h-4" />
                                Otvori u kalendaru
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* DNEVNIK - prikazati samo ako nije otvoren appointment */}
          {!isAppointmentExpanded && (
            <Card className="flex-1 border-l-4 border-l-primary cursor-pointer hover:bg-accent/5 transition-colors"
                   onClick={() => router.push("/carefree/journal")}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Moj Dnevnik
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Zapiši svoje misli i prati raspoloženje. Sve je enkriptirano.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
