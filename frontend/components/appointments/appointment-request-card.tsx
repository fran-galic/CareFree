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
  MessageSquare
} from "lucide-react";
import { AppointmentRequest } from "@/fetchers/appointments";
import { approveRequest, rejectRequest } from "@/fetchers/appointments";

interface AppointmentRequestCardProps {
  request: AppointmentRequest;
  onStatusChange: () => void;
}

export function AppointmentRequestCard({ request, onStatusChange }: AppointmentRequestCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

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

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approveRequest(request.id);
      onStatusChange();
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
      onStatusChange();
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
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Na čekanju</Badge>;
      case "accepted":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Prihvaćen</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Odbijen</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">Otkazan</Badge>;
      default:
        return <Badge variant="outline">{request.status}</Badge>;
    }
  };

  return (
    <Card className={`${request.crisis_flag ? "border-red-500 border-2" : ""}`}>
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
        <div className="bg-primary/5 p-4 rounded-lg space-y-2">
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
        {request.message && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              Razlog dolaska
            </div>
            <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
              {request.message}
            </p>
          </div>
        )}

        {/* AI sažetak */}
        {request.ai_summary && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">AI Sažetak</div>
            <p className="text-sm bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-900">
              {request.ai_summary}
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
                className="w-full sm:flex-1 gap-2 border-red-300 text-red-700 hover:bg-red-50"
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
    </Card>
  );
}
