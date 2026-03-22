"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BACKEND_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

interface PersistentAvatarProps {
  cacheKey: string;
  src?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  fallback: ReactNode;
}

type CachedAvatarEntry = {
  src: string;
  assetKey: string;
};

const avatarMemoryCache = new Map<string, CachedAvatarEntry>();

function normalizeAvatarSrc(src: string | null | undefined) {
  if (!src) {
    return null;
  }

  if (/^https?:\/\//i.test(src)) {
    return src;
  }

  if (src.startsWith("/")) {
    return `${BACKEND_URL.replace(/\/$/, "")}${src}`;
  }

  return src;
}

function getAssetKey(src: string) {
  return src.split("?")[0] || src;
}

function readCachedAvatar(cacheKey: string): CachedAvatarEntry | null {
  const memoryEntry = avatarMemoryCache.get(cacheKey);
  if (memoryEntry) {
    return memoryEntry;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as CachedAvatarEntry;
  } catch {
    return null;
  }
}

export function setPersistentAvatarCache(cacheKey: string, src: string | null | undefined) {
  const normalizedSrc = normalizeAvatarSrc(src);
  if (typeof window === "undefined" || !normalizedSrc) {
    return;
  }

  try {
    const entry: CachedAvatarEntry = {
      src: normalizedSrc,
      assetKey: getAssetKey(normalizedSrc),
    };
    avatarMemoryCache.set(cacheKey, entry);
    window.sessionStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // Best effort cache only.
  }
}

export function clearPersistentAvatarCache(cacheKey: string) {
  avatarMemoryCache.delete(cacheKey);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(cacheKey);
  } catch {
    // Best effort cache only.
  }
}

export function PersistentAvatar({
  cacheKey,
  src,
  alt,
  className,
  imageClassName,
  fallbackClassName,
  fallback,
}: PersistentAvatarProps) {
  const [cachedEntry, setCachedEntry] = useState<CachedAvatarEntry | null>(() => readCachedAvatar(cacheKey));
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setCachedEntry(readCachedAvatar(cacheKey));
    setImageFailed(false);
  }, [cacheKey]);

  useEffect(() => {
    const normalizedSrc = normalizeAvatarSrc(src);
    if (!normalizedSrc || typeof window === "undefined") {
      return;
    }

    const nextAssetKey = getAssetKey(normalizedSrc);
    const currentAssetKey = cachedEntry?.assetKey;

    if (currentAssetKey === nextAssetKey) {
      return;
    }

    const entry: CachedAvatarEntry = {
      src: normalizedSrc,
      assetKey: nextAssetKey,
    };

    setCachedEntry(entry);
    avatarMemoryCache.set(cacheKey, entry);
    setImageFailed(false);
    try {
      window.sessionStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch {
      // Best effort cache only.
    }
  }, [cacheKey, cachedEntry?.assetKey, src]);

  useEffect(() => {
    const normalizedSrc = normalizeAvatarSrc(src);
    if (!normalizedSrc || typeof window === "undefined") {
      return;
    }

    const image = new window.Image();
    image.decoding = "async";
    image.src = normalizedSrc;
  }, [src]);

  const resolvedSrc = useMemo(() => {
    const normalizedSrc = normalizeAvatarSrc(src);
    if (imageFailed) {
      if (normalizedSrc && normalizedSrc !== cachedEntry?.src) {
        return normalizedSrc;
      }
      return null;
    }
    return cachedEntry?.src || normalizedSrc || null;
  }, [cachedEntry?.src, imageFailed, src]);

  const handleImageError = () => {
    const normalizedSrc = normalizeAvatarSrc(src);
    if (normalizedSrc && cachedEntry?.src && cachedEntry.src !== normalizedSrc) {
      const nextEntry: CachedAvatarEntry = {
        src: normalizedSrc,
        assetKey: getAssetKey(normalizedSrc),
      };
      setCachedEntry(nextEntry);
      avatarMemoryCache.set(cacheKey, nextEntry);
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(cacheKey, JSON.stringify(nextEntry));
        }
      } catch {
        // Best effort cache only.
      }
      return;
    }

    setImageFailed(true);
  };

  return (
    <Avatar className={className}>
      {resolvedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          alt={alt || ""}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={cn("absolute inset-0 h-full w-full object-cover", imageClassName)}
          onError={handleImageError}
        />
      ) : null}
      {!resolvedSrc ? (
        <AvatarFallback className={fallbackClassName}>{fallback}</AvatarFallback>
      ) : null}
    </Avatar>
  );
}
