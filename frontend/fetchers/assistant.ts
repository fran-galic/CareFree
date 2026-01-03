import { fetcher } from "./fetcher";

const BACKEND_API = process.env.NEXT_PUBLIC_BACKEND_URL;

// Tipovi podataka prema backend modelu [4]
export interface AssistantMessage {
  id: number;
  sender: "student" | "bot";
  content: string;
  created_at: string;
}

export interface SessionResponse {
  id: number;
  is_active: boolean;
  created_at: string;
}

export interface MessageResponse {
  user_message: AssistantMessage;
  bot_message: AssistantMessage;
}

// 1. Pokreni ili dohvati aktivnu sesiju
export function startSession() {
  return fetcher<SessionResponse>(`${BACKEND_API}/assistant/session/start`, {
    method: "POST",
    credentials: "include",
  });
}

// 2. Pošalji poruku
export function sendMessage(content: string) {
  return fetcher<MessageResponse>(`${BACKEND_API}/assistant/session/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
    credentials: "include",
  });
}

// 3. Završi sesiju (generira sažetak)
export function endSession() {
  return fetcher<any>(`${BACKEND_API}/assistant/session/end`, {
    method: "POST",
    credentials: "include",
  });
}