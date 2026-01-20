
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
    if (isRefreshing && refreshPromise) {
        return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            const response = await fetch(`${API_URL}/auth/refresh/`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                console.error('Token refresh failed:', response.status);
                // Redirect to login if refresh fails
                if (typeof window !== 'undefined') {
                    window.location.href = '/accounts/login';
                }
                return false;
            }

            return true;
        } catch (error) {
            console.error('Token refresh error:', error);
            if (typeof window !== 'undefined') {
                window.location.href = '/accounts/login';
            }
            return false;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

export async function fetcher<T>(input: RequestInfo | URL, init?: RequestInit) : Promise<T> {
    try {
        const headers = new Headers(init?.headers || {});
        if (!headers.has('Accept')) headers.set('Accept', 'application/json');

        const body = init?.body;
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        if (!isFormData && body != null && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        const response = await fetch(input, {...init, headers, credentials: "include",
        });

        // If we get 401 Unauthorized, try to refresh the token
        if (response.status === 401) {
            const refreshSuccess = await refreshAccessToken();
            
            if (refreshSuccess) {
                // Retry the original request with new token
                const retryResponse = await fetch(input, {...init, headers, credentials: "include"});
                
                if (!retryResponse.ok) {
                    throw new Error(`Fetch failed after refresh: ${retryResponse.status} ${retryResponse.statusText}`)
                }

                if (retryResponse.status === 204) return null as unknown as T;
                return await retryResponse.json();
            } else {
                throw new Error('Authentication failed');
            }
        }

        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`)
        }

        if (response.status === 204) return null as unknown as T;
        return await response.json();
    } catch (error) {
        throw new Error(`Fetcher error: ${(error as Error).message}`);
    }
    
} 