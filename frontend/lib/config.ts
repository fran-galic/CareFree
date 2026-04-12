const PRODUCTION_BACKEND_FALLBACK = "https://carefree-production.up.railway.app";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (process.env.NODE_ENV === "production"
    ? PRODUCTION_BACKEND_FALLBACK
    : "http://localhost:8000");

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || `${BACKEND_URL}/api`;

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
