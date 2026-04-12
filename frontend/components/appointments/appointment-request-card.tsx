"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, 
  Clock, 
  User, 
  Mail, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Video
} from "lucide-react";
import { AppointmentRequest } from "@/fetchers/appointments";
import { approveRequest, rejectRequest, type Appointment } from "@/fetchers/appointments";

interface AppointmentRequestCardProps {
  request: AppointmentRequest;
  onStatusChange: (result?: {
    action: "approved" | "rejected";
    request: AppointmentRequest;
    appointment?: Appointment;
  }) => void;
}

export function AppointmentRequestCard({ request, onStatusChange }: AppointmentRequestCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showAiContextModal, setShowAiContextModal] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString("hr-HR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("hr-HR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const { date, time } = formatDateTime(request.requested_start);
  const appointmentEnd = new Date(request.requested_end);
  const isPastAppointment = appointmentEnd.getTime() < Date.now();
  const primaryReasonText = (request.message || request.ai_summary || "").trim();

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const appointment = await approveRequest(request.id);
      onStatusChange({ action: "approved", request, appointment });
    } catch (error) {
      console.error("Failed to approve:", error);
      alert("Greška pri odobravanju zahtjeva");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await rejectRequest(request.id, rejectReason || undefined);
      onStatusChange({ action: "rejected", request });
    } catch (error) {
      console.error("Failed to reject:", error);
      alert("Greška pri odbijanju zahtjeva");
    } finally {
      setIsRejecting(false);
      setShowRejectForm(false);
      setRejectReason("");
    }
  };

  const getStatusBadge = () => {
    switch (request.status) {
      case "pending":
        return <Badge variant="outline" className="border-primary/30 bg-secondary text-primary">Na čekanju</Badge>;
      case "accepted":
        return <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">Prihvaćen</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Odbijen</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">Otkazan</Badge>;
      default:
        return <Badge variant="outline">{request.status}</Badge>;
    }
  };

  return (
    <Card className={`${request.crisis_flag ? "border-red-400 border-2" : "border-border/80 border-t-[3px] border-l-[3px] border-t-primary/28 border-l-primary/28"} bg-[linear-gradient(180deg,rgba(231,244,241,0.18)_0%,rgba(255,255,255,1)_24%)]`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-lg">
                {request.student.first_name} {request.student.last_name}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-3 h-3" />
              {request.student.email}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge()}
            {request.crisis_flag && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" />
                Krizna situacija
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Datum i vrijeme */}
        <div className="space-y-2 rounded-xl border border-primary/15 bg-secondary/65 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="font-medium">{date}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-2xl font-bold text-primary">{time}</span>
          </div>
        </div>

        {/* Poruka */}
        {primaryReasonText && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              Razlog dolaska
            </div>
            <p className="whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/70 p-3 text-sm">
              {primaryReasonText}
            </p>
          </div>
        )}

        {/* AI kategorija */}
        {request.ai_category && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Kategorija:</span>
            <Badge variant="secondary">{request.ai_category}</Badge>
          </div>
        )}

        {(request.ai_summary || request.ai_transcript_shared) && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              AI kontekst dostupan
            </Badge>
            {request.ai_transcript_shared ? (
              <Badge variant="secondary">Student je podijelio i cijeli razgovor</Badge>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                setShowAiContextModal(true);
                setShowFullTranscript(false);
              }}
            >
              Prikaži AI kontekst
            </Button>
          </div>
        )}

        {request.status !== "pending" && (
          <div className="space-y-2 rounded-xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm font-medium text-foreground">Status zahtjeva</p>
            {request.status === "accepted" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Zahtjev je prihvaćen i termin je kreiran. Daljnji detalji nalaze se u kalendaru.
                </p>
                {isPastAppointment ? (
                  <p className="text-sm text-slate-600">
                    Ovaj termin je prošao i prikazuje se samo kao dio povijesti zahtjeva.
                  </p>
                ) : null}
                {request.appointment_status === "confirmed_pending_sync" && !isPastAppointment ? (
                  <p className="text-sm text-amber-700">
                    Google Meet link se još priprema i pojavit će se u kalendaru čim sinkronizacija završi.
                  </p>
                ) : null}
                {request.appointment_status === "confirmed_sync_failed" && !isPastAppointment ? (
                  <p className="text-sm text-red-700">
                    Termin je potvrđen, ali Google Meet link trenutno nije generiran. Termin je i dalje vidljiv u kalendaru.
                  </p>
                ) : null}
                {request.appointment_conference_link && !isPastAppointment ? (
                  <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Google Meet</p>
                    <p className="mt-1 break-all text-sm text-foreground">{request.appointment_conference_link}</p>
                  </div>
                ) : null}
              </>
            ) : request.status === "rejected" ? (
              <p className="text-sm text-muted-foreground">
                Zahtjev je odbijen. Student može odabrati drugi termin.
              </p>
            ) : request.status === "cancelled" ? (
              <p className="text-sm text-muted-foreground">
                Ovaj zahtjev je otkazan.
              </p>
            ) : null}
          </div>
        )}

        {request.appointment_feedback ? (
          <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-sm font-medium text-foreground">Povratna informacija nakon razgovora</p>
            <p className="text-sm text-primary">
              {request.appointment_feedback.selected_response === "calmer" && "Student se nakon razgovora osjeća mirnije."}
              {request.appointment_feedback.selected_response === "helped" && "Student navodi da mu je razgovor pomogao."}
              {request.appointment_feedback.selected_response === "clearer" && "Student kaže da je nakon razgovora dobio/la više jasnoće."}
              {request.appointment_feedback.selected_response === "processing" && "Student još razmišlja o razgovoru i dojmovima nakon susreta."}
            </p>
            {request.appointment_feedback.comment ? (
              <p className="whitespace-pre-wrap rounded-lg border border-primary/10 bg-background/80 p-3 text-sm text-foreground/85">
                {request.appointment_feedback.comment}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Forma za odbijanje */}
        {showRejectForm && (
          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium">Razlog odbijanja (opcionalno)</label>
            <Textarea
              placeholder="Npr. Nisam dostupan u to vrijeme..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
        )}
      </CardContent>

      {request.status === "pending" && (
        <CardFooter className="gap-2 flex-col sm:flex-row">
          {!showRejectForm ? (
            <>
              <Button
                onClick={handleApprove}
                disabled={isApproving}
                className="w-full sm:flex-1 gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isApproving ? "Odobravam..." : "Prihvati termin"}
              </Button>
              <Button
                onClick={() => setShowRejectForm(true)}
                variant="outline"
                className="w-full sm:flex-1 gap-2 border-red-200 text-red-700 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" />
                Odbij
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleReject}
                disabled={isRejecting}
                variant="destructive"
                className="w-full sm:flex-1"
              >
                {isRejecting ? "Odbijem..." : "Potvrdi odbijanje"}
              </Button>
              <Button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
                variant="outline"
                className="w-full sm:flex-1"
              >
                Odustani
              </Button>
            </>
          )}
        </CardFooter>
      )}

      {request.status === "accepted" && request.appointment_conference_link && !isPastAppointment && (
        <CardFooter>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => window.open(request.appointment_conference_link!, "_blank")}
          >
            <Video className="w-4 h-4" />
            Otvori Google Meet
          </Button>
        </CardFooter>
      )}

      {showAiContextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Kontekst prije susreta</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ove informacije student je podijelio kroz Juliju prije slanja zahtjeva.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAiContextModal(false)}>
                Zatvori
              </Button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {request.ai_summary ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">AI sažetak</p>
                  <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/85">
                    {request.ai_summary}
                  </div>
                </div>
              ) : null}

              {request.ai_transcript_shared && request.ai_transcript_snapshot.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Cijeli AI razgovor</p>
                      <p className="text-xs text-muted-foreground">
                        Prikazuje se samo zato što je student dao izričitu privolu.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFullTranscript((prev) => !prev)}
                    >
                      {showFullTranscript ? "Sakrij razgovor" : "Prikaži razgovor"}
                    </Button>
                  </div>

                  {showFullTranscript ? (
                    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/35 p-4">
                      {request.ai_transcript_snapshot.map((message, index) => (
                        <div
                          key={`${message.sequence}-${index}`}
                          className={`rounded-xl px-3 py-2 text-sm ${
                            message.sender === "student"
                              ? "bg-background border border-border/60"
                              : "bg-primary/5 border border-primary/10"
                          }`}
                        >
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {message.sender === "student" ? "Student" : "Julija"}
                          </p>
                          <p className="whitespace-pre-wrap leading-relaxed text-foreground/85">{message.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
