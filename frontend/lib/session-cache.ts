type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export function readSessionCache<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== "number") {
      window.sessionStorage.removeItem(key);
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.value;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, value: T, ttlMs: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Best effort only.
  }
}

export function clearSessionCache(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Best effort only.
  }
}
