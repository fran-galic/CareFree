import { fetcher } from "./fetcher";

const BACKEND_API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface Caretaker {
  user_id: string;
  first_name: string;
  last_name: string;
  academic_title: string;
  help_categories: string[];
  user_image_url: string | null;
  specialisation: string;
  about_me: string;
  working_since: string;
}

// Tipovi za kategorije
export interface SubCategory {
    id: number;
    label: string;
    slug: string;
}

export interface HelpCategory {
    id: number;
    label: string;
    slug: string;
    subcategories: SubCategory[];
}

export interface PaginatedCaretakerResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Array<Caretaker>;
}

// 1. Nova funkcija za dohvat kategorija (za filtere)
export function getHelpCategories() {
    return fetcher<{ categories: HelpCategory[] }>(`${BACKEND_API}/users/caretakers/help-categories/`, {
        credentials: "include"
    });
}

// 2. Ažurirana pretraga koja prima i kategorije
export function searchCaretakers(query: string, categories: string[] = [], page: number = 1) {
  const params = new URLSearchParams();
  
  if (query) params.append("name", query); // Backend očekuje "name" za tekstualnu pretragu [2]
  
  // Dodajemo svaku odabranu kategoriju u URL (npr. &categories=anksioznost&categories=stres)
  categories.forEach(cat => params.append("categories", cat));
  
  // Dodajemo page parametar
  if (page > 1) params.append("page", page.toString());

  return fetcher<PaginatedCaretakerResponse>(
      `${BACKEND_API}/users/caretakers/search/?${params.toString()}`, 
      { credentials: "include" }
  );
}

export function searchCaretakerById(id: string) {
  return fetcher<any>(`${BACKEND_API}/users/caretakers/caretaker/${id}`, { // maknuo sam encodeURIComponent jer id je obicno clean
      credentials: "include"
  });
}

// Tipovi za caretaker profil
export interface CaretakerProfile {
  about_me: string;
  tel_num: string;
  image?: string;
  image_mime_type?: string;
  grad_year: number | null;
  help_categories: number[];
  is_profile_complete: boolean;
  is_approved: boolean;
  approval_status: 'PENDING' | 'APPROVED' | 'DENIED';
  cv_filename?: string | null;
  diploma_filenames?: string[];
  incomplete_reason?: string; // Backend može vratiti razlog zašto profil nije potpun
}

// Dohvat caretaker profila
export async function getCaretakerProfile(): Promise<CaretakerProfile> {
  return fetcher<CaretakerProfile>(`${BACKEND_API}/auth/caretaker/register/`, {
    credentials: "include"
  });
}

// Upload CV-a
export async function uploadCV(file: File): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BACKEND_API}/auth/caretaker/cv/`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'CV upload failed');
  }

  return response.json();
}

// Upload diplome
export async function uploadDiploma(file: File): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BACKEND_API}/auth/caretaker/diploma/`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Diploma upload failed');
  }

  return response.json();
}

// Upload profilne slike
export async function uploadCaretakerImage(file: File): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${BACKEND_API}/auth/caretaker/image/`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Image upload failed');
  }

  return response.json();
}

// Ažuriranje caretaker profila
export async function updateCaretakerProfile(data: Partial<CaretakerProfile>): Promise<CaretakerProfile> {
  const response = await fetch(`${BACKEND_API}/auth/caretaker/register/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.error || 'Profile update failed');
  }

  return response.json();
}
