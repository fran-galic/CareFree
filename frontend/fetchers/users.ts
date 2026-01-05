import { fetcher } from "./fetcher";

const BACKEND_API = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface Caretaker {
  user_id: string;
  first_name: string;
  last_name: string;
  academic_title: string;
  help_categories: string[];
  user_image_url: string | null;
  specialisation: string;
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
    return fetcher<{ categories: HelpCategory[] }>(`${BACKEND_API}/users/caretakers/help-categories`, {
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