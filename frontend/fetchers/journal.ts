import { fetcher } from "./fetcher";

const BACKEND_API = process.env.NEXT_PUBLIC_BACKEND_URL;

// Tipovi podataka prema backend modelu [5]
export interface JournalEntry {
  id: number;
  title: string;
  content: string; // Backend ovo šalje dekriptirano [6]
  mood: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewJournalEntry {
  title: string;
  content: string;
  mood: string;
}

// 1. Dohvati sve zapise studenta (GET /api/journal/)
export function getJournalEntries() {
  return fetcher<JournalEntry[]>(`${BACKEND_API}/api/journal/`, {
    credentials: "include",
  });
}

// 2. Kreiraj novi zapis (POST /api/journal/)
export function createJournalEntry(data: NewJournalEntry) {
  return fetcher<JournalEntry>(`${BACKEND_API}/api/journal/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    credentials: "include",
  });
}

// 3. Obriši zapis (DELETE /api/journal/{id}/) - [7]
export function deleteJournalEntry(id: number) {
    return fetcher<void>(`${BACKEND_API}/api/journal/${id}/`, {
      method: "DELETE",
      credentials: "include",
    });
}