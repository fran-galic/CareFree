"use client";

import { PersistentAvatar } from "@/components/persistent-avatar-image";
import { Badge } from "@/components/ui/badge";

interface ProfileHeaderProps {
  userId?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: "student" | "caretaker";
  imageUrl?: string | null;
  academicTitle?: string;
}

export function ProfileHeader({ 
  userId,
  firstName, 
  lastName, 
  email, 
  role, 
  imageUrl,
  academicTitle 
}: ProfileHeaderProps) {
  
  const isCaretaker = role === "caretaker";
  const displayName = firstName && lastName 
    ? `${firstName} ${lastName}` 
    : firstName || "Moj Profil";
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.trim().toUpperCase() || (isCaretaker ? "P" : "S");

  return (
    <div className="mb-12 flex flex-col md:flex-row items-center md:items-start gap-8 animate-in fade-in duration-500">
      <PersistentAvatar
        cacheKey={role === "caretaker" ? `avatar:self:${userId || email}` : `avatar:profile-header:${role}:${email}`}
        src={imageUrl}
        alt={displayName}
        className="w-32 h-32 border-4 border-background shadow-xl ring-1 ring-muted"
        fallbackClassName="text-6xl font-bold bg-primary/10 text-primary"
        fallback={initials}
      />

      <div className="space-y-3 pt-2 text-center md:text-left">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          {displayName}
        </h1>
        
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-3 text-muted-foreground md:mx-0 md:justify-start">
          <Badge variant="secondary">
            {isCaretaker ? "Psiholog" : "Student"}
          </Badge>
          <span className="text-sm">•</span>
          <span className="text-sm font-medium">{email}</span>
          
          {isCaretaker && academicTitle && (
            <>
              <span className="text-sm">•</span>
              <span className="text-sm font-medium">{academicTitle}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
