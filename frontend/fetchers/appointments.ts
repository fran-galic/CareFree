import { fetcher } from "./fetcher";
import { BACKEND_URL } from "@/lib/config";

const BACKEND_API = BACKEND_URL;

export interface AppointmentRequest {
  id: number;
  student: {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  caretaker: {
    user_id: number;
    first_name: string;
    last_name: string;
  };
  requested_start: string;
  requested_end: string;
  message: string;
  ai_summary?: string;
  ai_category?: string;
  crisis_flag: boolean;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: number;
  caretaker: {
    user_id: number;
    first_name: string;
    last_name: string;
  };
  student?: {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  start: string;
  end: string;
  status: string;
  conference_link?: string;
  duration_minutes: number;
}

export interface Slot {
  start: string;
  end: string;
  time: string;
  is_available: boolean;
}

/**
 * Dohvaća zahtjeve za termine za trenutno ulogiranog psihologa
 */
export async function getCaretakerRequests(status?: string): Promise<AppointmentRequest[]> {
  const url = status 
    ? `${BACKEND_API}/api/appointments/caretaker/requests/?status=${status}`
    : `${BACKEND_API}/api/appointments/caretaker/requests/`;
  
  return fetcher(url);
}

/**
 * Prihvaća zahtjev za termin
 */
export async function approveRequest(requestId: number): Promise<Appointment> {
  const response = await fetch(
    `${BACKEND_API}/api/appointments/caretaker/requests/${requestId}/approve/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to approve request" }));
    throw new Error(error.detail || "Failed to approve request");
  }

  return response.json();
}

/**
 * Odbija zahtjev za termin
 */
export async function rejectRequest(requestId: number, reason?: string): Promise<void> {
  const response = await fetch(
    `${BACKEND_API}/api/appointments/caretaker/requests/${requestId}/reject/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: reason ? JSON.stringify({ reason }) : undefined,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to reject request" }));
    throw new Error(error.detail || "Failed to reject request");
  }
}

/**
 * Dohvaća sve appointmente za trenutno ulogiranog psihologa (caretakera)
 */
export async function getCaretakerAppointments(): Promise<Appointment[]> {
  return fetcher(`${BACKEND_API}/api/appointments/caretaker/`);
}

/**
 * Dohvaća dostupne slotove za određenog psihologa
 */
export async function getCaretakerSlots(
  caretakerId: number,
  days: number = 3
): Promise<Slot[]> {
  const url = `${BACKEND_API}/api/appointments/caretaker/slots/?caretaker_id=${caretakerId}&days=${days}`;
  return fetcher(url);
}

/**
 * Kreira zahtjev za termin (student)
 */
export async function createAppointmentRequest(data: {
  caretaker_id: number;
  start_time: string;
  slot_time: string;
  note?: string;
}): Promise<AppointmentRequest> {
  const response = await fetch(`${BACKEND_API}/api/appointments/request/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to create request" }));
    throw new Error(error.detail || "Failed to create request");
  }

  return response.json();
}

/**
 * Dohvaća termine trenutno ulogiranog korisnika (student ili psiholog)
 */
export async function getMyAppointments(): Promise<Appointment[]> {
  return fetcher(`${BACKEND_API}/api/appointments/calendar/my/`);
}

/**
 * Kreira hold na slot (privremena rezervacija za 10 min)
 */
export async function createHold(data: {
  caretaker_id: number;
  slot_start: string;
  hold_minutes?: number;
}): Promise<{ id: number; start: string; expires_at: string; status: string }> {
  const response = await fetch(`${BACKEND_API}/api/appointments/holds/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to create hold" }));
    throw new Error(error.detail || "Failed to create hold");
  }

  return response.json();
}

/**
 * Oslobađa hold (cancel privremene rezervacije)
 */
export async function releaseHold(holdId: number): Promise<void> {
  const response = await fetch(`${BACKEND_API}/api/appointments/holds/${holdId}/release/`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to release hold");
  }
}
