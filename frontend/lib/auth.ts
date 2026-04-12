import { BACKEND_URL } from "@/lib/config";

const ACCESS_TOKEN_KEY = "carefree:auth:access";
const REFRESH_TOKEN_KEY = "carefree:auth:refresh";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!canUseStorage()) return null;
  return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeAuthTokens(access?: string | null, refresh?: string | null) {
  if (!canUseStorage()) return;
  if (access) {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, access);
  }
  if (refresh) {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function clearAuthTokens() {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

function withAuthHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers || {});
  const accessToken = getAccessToken();
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const body = init?.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData && body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

export async function refreshAccessToken(redirectOnFailure = true): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh: getRefreshToken(),
        }),
      });

      if (!response.ok) {
        clearAuthTokens();
        if (redirectOnFailure && typeof window !== "undefined") {
          window.location.href = "/accounts/login";
        }
        return false;
      }

      const data = await response.json().catch(() => ({}));
      storeAuthTokens(data.access ?? null, data.refresh ?? null);
      return true;
    } catch {
      clearAuthTokens();
      if (redirectOnFailure && typeof window !== "undefined") {
        window.location.href = "/accounts/login";
      }
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit, redirectOnAuthFailure = true) {
  const headers = withAuthHeaders(init);
  let response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status !== 401) {
    return response;
  }

  const refreshSuccess = await refreshAccessToken(redirectOnAuthFailure);
  if (!refreshSuccess) {
    return response;
  }

  response = await fetch(input, {
    ...init,
    headers: withAuthHeaders(init),
    credentials: "include",
  });
  return response;
}
