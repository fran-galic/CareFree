"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/fetchers/fetcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton"; // Koristimo skeleton za loading
import { 
  Home, 
  MessageCircle, 
  CalendarDays, 
  BookOpen, 
  Search 
} from "lucide-react";
import Image from "next/image";

// Definiramo točne tipove
interface User {
  id: string;
  email: string;
  role: "student" | "caretaker";
  first_name?: string; 
  last_name?: string;
  caretaker?: { user_image_url?: string }; 
}

export default function CarefreeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // 1. DOHVAT KORISNIKA
  const { data: user, isLoading } = useSWR<User>("/users/me/", fetcher);

  const isActive = (path: string) => pathname === path;
  
  const navLinkClass = (path: string) => 
    `flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium ${
      isActive(path) 
        ? "bg-primary text-primary-foreground shadow-md font-bold" 
        : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
    }`;

  // 2. DEFINICIJA LINKOVA (Različite liste)
  const studentLinks = [
    { href: "/carefree/main", label: "Home", icon: Home },
    { href: "/carefree/messages", label: "Chat", icon: MessageCircle },
    { href: "/carefree/calendar", label: "Kalendar", icon: CalendarDays },
    { href: "/carefree/journal", label: "Dnevnik", icon: BookOpen },
    { href: "/carefree/search", label: "Pretraga", icon: Search },
  ];

  const caretakerLinks = [
    { href: "/carefree/main", label: "Dashboard", icon: Home },
    // Psiholog nema Chat ni Dnevnik prema specifikaciji
    { href: "/carefree/calendar", label: "Moji Termini", icon: CalendarDays },
    { href: "/carefree/search", label: "Baza kolega", icon: Search },
  ];

  // 3. LOGIKA ODABIRA (Samo ako imamo user podatke)
  const isCaretaker = user?.role === "caretaker";
  const navigationLinks = isCaretaker ? caretakerLinks : studentLinks;

  // 4. LOADING STANJE - KLJUČNO PROTIV TREPERENJA
  // Dok se podaci učitavaju, prikazujemo "kostur" headera, ne krivi header
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 w-full border-b bg-card/90 backdrop-blur-md shadow-sm h-20 flex items-center justify-between px-4 container mx-auto">
           {/* Logo loading */}
           <div className="flex items-center gap-3">
             <Skeleton className="w-10 h-10 rounded-full" />
             <Skeleton className="w-24 h-6" />
           </div>
           {/* Nav loading */}
           <div className="hidden md:flex gap-2">
             <Skeleton className="w-20 h-8 rounded-full" />
             <Skeleton className="w-20 h-8 rounded-full" />
             <Skeleton className="w-20 h-8 rounded-full" />
           </div>
           {/* Profile loading */}
           <div className="flex items-center gap-2">
             <Skeleton className="w-9 h-9 rounded-full" />
             <Skeleton className="w-24 h-8 rounded-full" />
           </div>
        </header>
        <main className="flex-1 w-full p-6 space-y-4">
           <Skeleton className="h-12 w-1/3" />
           <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  // 5. RENDERIRANJE STVARNOG SADRŽAJA (Kad znamo tko je user)
  return (
    // Ako želimo boje, ovdje bi išao className={isCaretaker ? "theme-caretaker" : ""}
    <div className={`min-h-screen bg-background flex flex-col`}>
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/90 backdrop-blur-md shadow-sm transition-colors duration-500">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          
          {/* LOGO */}
          <Link href="/carefree/main" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative w-10 h-10">
              <Image 
                src="/images/carefree-logo-assistant-new.png" 
                alt="CareFree Logo" 
                fill
                className="object-contain"
              />
            </div>
            <span className="text-2xl font-bold text-primary tracking-tight">CareFree</span>
          </Link>

          {/* NAVIGACIJA - Renderiramo ispravnu listu */}
          <nav className="hidden md:flex items-center gap-1 bg-secondary/30 p-1.5 rounded-full border border-secondary/50">
            {navigationLinks.map((link) => (
              <Link key={link.href} href={link.href} className={navLinkClass(link.href)}>
                <link.icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* PROFIL (DESNI KUT) */}
          <div className="flex items-center gap-4">
            <Link href="/carefree/myprofile">
              <div className={`flex items-center gap-3 pl-1 pr-4 py-1 rounded-full border transition-all cursor-pointer group ${
                isActive("/carefree/myprofile") 
                  ? "border-primary bg-primary/5" 
                  : "border-transparent hover:bg-accent"
              }`}>
                <Avatar className="w-9 h-9 border-2 border-background shadow-sm group-hover:border-primary/50 transition-colors">
                  <AvatarImage 
                    src={isCaretaker ? user?.caretaker?.user_image_url || "" : ""} 
                    className="object-cover" 
                  />
                  {/* LOGIKA ZA S / P U KRUGU */}
                  <AvatarFallback className={`text-sm font-bold ${
                    isCaretaker 
                      ? 'bg-orange-100 text-orange-600' // Narančasto za P
                      : 'bg-teal-100 text-teal-600'     // Zeleno za S
                  }`}>
                    {isCaretaker ? 'P' : 'S'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors">
                     {user?.first_name ? user.first_name : "Moj Profil"}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {/* Hardkodiran ispis uloge */}
                    {isCaretaker ? 'Psiholog' : 'Student'}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* GLAVNI SADRŽAJ */}
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
}