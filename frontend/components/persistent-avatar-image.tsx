"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  if (typeof window === "undefined" || !src) {
    return;
  }

  try {
    const entry: CachedAvatarEntry = {
      src,
      assetKey: getAssetKey(src),
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
    if (!src || typeof window === "undefined") {
      return;
    }

    const nextAssetKey = getAssetKey(src);
    const currentAssetKey = cachedEntry?.assetKey;

    if (currentAssetKey === nextAssetKey) {
      return;
    }

    const entry: CachedAvatarEntry = {
      src,
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

  const resolvedSrc = useMemo(() => {
    if (imageFailed) {
      return null;
    }
    return cachedEntry?.src || src || null;
  }, [cachedEntry?.src, imageFailed, src]);

  return (
    <Avatar className={className}>
      {resolvedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          alt={alt || ""}
          className={cn("absolute inset-0 h-full w-full object-cover", imageClassName)}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      {!resolvedSrc ? (
        <AvatarFallback className={fallbackClassName}>{fallback}</AvatarFallback>
      ) : null}
    </Avatar>
  );
}
