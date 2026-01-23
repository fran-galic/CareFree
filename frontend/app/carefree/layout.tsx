"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/fetchers/fetcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Home, 
  MessageCircle, 
  CalendarDays, 
  BookOpen, 
  Search,
  Clock,
  Inbox,
  CalendarCheck
} from "lucide-react";
import Image from "next/image";
import { Footer } from "@/components/footer";

const BACKEND_API = process.env.NEXT_PUBLIC_BACKEND_URL;

// Definiramo tipove podataka koji dolaze s backenda
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
  const router = useRouter();
  
  
  const { data: user, isLoading, error } = useSWR<User>(
    `${BACKEND_API}/users/me/`, 
    fetcher,
    {
      revalidateOnMount: true,
      dedupingInterval: 0
    }
  );

  
  useEffect(() => {
    if (error && error.message.includes('401') && !isLoading) {
      router.push('/accounts/login');
    }
  }, [error, isLoading, router]);

  
  const isActive = (path: string) => {
    
    if (path === "/carefree/profile") {
        return pathname.includes("/carefree/profile/");
    }
    return pathname === path;
  }
  
  const navLinkClass = (path: string) => 
    `flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium ${
      isActive(path) 
        ? "bg-primary text-primary-foreground shadow-md font-bold" 
        : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
    }`;

  
  const studentLinks = [
    { href: "/carefree/main", label: "Početna", icon: Home },
    { href: "/carefree/messages", label: "Razgovor", icon: MessageCircle },
    { href: "/carefree/journal", label: "Dnevnik", icon: BookOpen },
    { href: "/carefree/search", label: "Pretraga", icon: Search },
  ];

  const caretakerLinks = [
    { href: "/carefree/main", label: "Početna", icon: Home },
    { href: "/carefree/availability", label: "Moj kalendar", icon: CalendarDays },
    { href: "/carefree/dostupnost", label: "Dostupnost", icon: CalendarCheck },
    { href: "/carefree/requests", label: "Zahtjevi studenata", icon: Inbox },
  ];

  
  const isCaretaker = user?.role === "caretaker";
  const navigationLinks = isCaretaker ? caretakerLinks : studentLinks;

  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 w-full border-b bg-card/90 backdrop-blur-md shadow-sm h-20 flex items-center justify-between px-4 container mx-auto">
          
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="w-24 h-6" />
          </div>
          
          <div className="hidden md:flex gap-2">
            <Skeleton className="w-20 h-8 rounded-full" />
            <Skeleton className="w-20 h-8 rounded-full" />
            <Skeleton className="w-20 h-8 rounded-full" />
          </div>
          
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

  
  return (
    <div className={`min-h-screen bg-background flex flex-col`} data-theme={user?.role === "caretaker" ? "caretaker" : "student"}>
      
      
      <header className="sticky top-0 z-50 w-full border-b bg-card/90 backdrop-blur-md shadow-sm transition-colors duration-500">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          
          
          <Link href="/carefree/main" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative w-10 h-10">
              <Image 
                src="/images/carefree-logo-assistant-new.png" 
                alt="CareFree Logo" 
                fill
                className="object-contain"
              />
            </div>
            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-[oklch(0.783_0.1136_182.2)] to-[oklch(0.68_0.20_45)] bg-clip-text text-transparent">CareFree</span>
          </Link>

          
          <nav className="hidden md:flex items-center gap-1 bg-secondary/30 p-1.5 rounded-full border border-secondary/50">
            {navigationLinks.map((link) => (
              <Link key={link.href} href={link.href} className={navLinkClass(link.href)}>
                <link.icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>

          
          <div className="flex items-center gap-4">
            <Link href={isCaretaker ? "/carefree/profile/caretaker" : "/carefree/profile/student"}>
              <div className={`flex items-center gap-3 pl-1 pr-4 py-1 rounded-full border transition-all cursor-pointer group ${
                isActive("/carefree/profile") 
                  ? "border-primary bg-primary/5" 
                  : "border-transparent hover:bg-primary/5 hover:border-primary"
              }`}>
                <Avatar className="w-9 h-9 border-2 border-background shadow-sm group-hover:border-primary/50 transition-colors">
                  <AvatarImage 
                    src={isCaretaker ? user?.caretaker?.user_image_url || "" : ""} 
                    className="object-cover" 
                  />
                  
                  <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                    {isCaretaker ? 'P' : 'S'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors">
                    {user?.first_name ? user.first_name : "Moj Profil"}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {isCaretaker ? 'Psiholog' : 'Student'}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}