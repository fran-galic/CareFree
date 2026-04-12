import { authFetch } from "@/lib/auth";

export async function fetcher<T>(input: RequestInfo | URL, init?: RequestInit) : Promise<T> {
    try {
        const response = await authFetch(input, init);

        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`)
        }

        if (response.status === 204) return null as unknown as T;
        return await response.json();
    } catch (error) {
        const message = (error as Error).message || "Unknown error";
        if (message.includes("Failed to fetch")) {
            throw new Error("Fetcher error: Backend trenutno nije dostupan.");
        }
        throw new Error(`Fetcher error: ${message}`);
    }
    
} 
