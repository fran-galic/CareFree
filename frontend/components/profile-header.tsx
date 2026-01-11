"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface ProfileHeaderProps {
  firstName?: string;
  lastName?: string;
  email: string;
  role: "student" | "caretaker";
  imageUrl?: string | null;
  academicTitle?: string;
}

export function ProfileHeader({ 
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

  return (
    <div className="mb-12 flex flex-col md:flex-row items-center md:items-start gap-8 animate-in fade-in duration-500">
      <Avatar className="w-32 h-32 border-4 border-background shadow-xl ring-1 ring-muted">
        <AvatarImage 
          src={imageUrl || ""} 
          className="object-cover"
        />
        {/* Koristimo neutralnu boju da paše na obje stranice */}
        <AvatarFallback className="text-6xl font-bold bg-primary/10 text-primary">
          {isCaretaker ? "P" : "S"}
        </AvatarFallback>
      </Avatar>

      <div className="text-center md:text-left space-y-3 pt-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          {displayName}
        </h1>
        
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-muted-foreground">
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