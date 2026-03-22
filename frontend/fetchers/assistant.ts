import { BACKEND_URL } from "@/lib/config";
import { fetcher } from "./fetcher";
import type { Caretaker } from "./users";

const BACKEND_API = BACKEND_URL;

export type AssistantSessionMode = "support" | "recommendation" | "crisis";
export type AssistantSessionStatus =
  | "active"
  | "recommendation_offered"
  | "recommendation_ready"
  | "support_completed"
  | "recommendation_completed"
  | "crisis_active"
  | "ended_manual";

export interface AssistantMessage {
  id: number;
  sender: "student" | "bot";
  content: string;
  sequence?: number;
  created_at: string;
}

export interface AssistantUiHint {
  welcome_message: string;
  can_recommend_psychologists: boolean;
  crisis_contacts: {
    urgent: string;
    crisis_center: string;
    plavi_telefon: string;
  };
}

export interface AssistantSessionData {
  id: number;
  is_active: boolean;
  mode: AssistantSessionMode;
  status: AssistantSessionStatus;
  closure_reason: string | null;
  main_category: string;
  subcategories: string[];
  danger_flag: boolean;
  created_at: string;
  ended_at: string | null;
}

export interface SessionResponse {
  session: AssistantSessionData;
  messages: AssistantMessage[];
  created: boolean;
  ui_hint: AssistantUiHint;
}

export interface MessageResponse {
  user_message: AssistantMessage;
  bot_message: AssistantMessage;
  session_mode: AssistantSessionMode;
  session_status: AssistantSessionStatus;
  danger_flag: boolean;
  show_crisis_panel: boolean;
  show_recommendations: boolean;
  recommended_caretakers: Caretaker[];
  recommendation_summary: string;
  recommendation_match_scope: "subcategory" | "category" | "general" | null;
  session_closed: boolean;
  summary_id: number | null;
  ui_hint: AssistantUiHint;
}

export interface EndSessionResponse {
  message: string;
  session_closed: boolean;
  session_status: AssistantSessionStatus;
  summary_id: number | null;
}

export interface AssistantSummaryDetail {
  id: number;
  created_at: string;
  summary_text: string;
  summary_type: "support" | "recommendation" | "crisis";
  main_category: string;
  subcategories: string[];
  recommended_caretakers: Caretaker[];
  messages: Array<{
    sender: "student" | "bot";
    content: string;
    created_at: string;
    sequence: number;
  }>;
  closure_reason: string | null;
  session_status: AssistantSessionStatus | null;
}

export interface AssistantSummaryListItem {
  id: number;
  created_at: string;
  summary_text: string;
  summary_type: "support" | "recommendation" | "crisis";
  main_category_code: string;
  main_category: string;
  subcategory_codes: string[];
  subcategories: string[];
}

export function startSession() {
  return fetcher<SessionResponse>(`${BACKEND_API}/assistant/session/start`, {
    method: "POST",
    credentials: "include",
  });
}

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

export function endSession() {
  return fetcher<EndSessionResponse>(`${BACKEND_API}/assistant/session/end`, {
    method: "POST",
    credentials: "include",
  });
}

export function getAssistantSummaries() {
  return fetcher<AssistantSummaryListItem[]>(`${BACKEND_API}/assistant/summaries`, {
    credentials: "include",
  });
}
