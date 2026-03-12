"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/fetchers/fetcher";
import { PersistentAvatar } from "@/components/persistent-avatar-image";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Home, 
  MessageCircle, 
  CalendarDays, 
  BookOpen, 
  Search,
  Inbox,
  CalendarCheck,
  Menu,
  X,
  LogOut
} from "lucide-react";
import Image from "next/image";
import { Footer } from "@/components/footer";

const BACKEND_API = process.env.NEXT_PUBLIC_BACKEND_URL;
const USER_CACHE_KEY = "carefree-user-cache";

// Definiramo tipove podataka koji dolaze s backenda
interface User {
  id: string;
  email: string;
  role: "student" | "caretaker";
  first_name?: string; 
  last_name?: string;
  caretaker?: { user_image_url?: string }; 
}

function readCachedUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function getInitials(firstName?: string, lastName?: string) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.trim().toUpperCase();
  return initials || "CF";
}

export default function CarefreeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [cachedUser, setCachedUser] = useState<User | null>(readCachedUser);
  
  
  const { data: user, isLoading, error } = useSWR<User>(
    `${BACKEND_API}/users/me/`, 
    fetcher,
    {
      fallbackData: cachedUser ?? undefined,
      revalidateOnMount: true,
      dedupingInterval: 0
    }
  );

  useEffect(() => {
    if (error && error.message.includes('401') && !isLoading) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(USER_CACHE_KEY);
      }
      router.push('/accounts/login');
    }
  }, [error, isLoading, router]);

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      return;
    }

    setCachedUser(user);
    try {
      window.sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } catch {
      // Best effort cache only.
    }
  }, [user]);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingUp = currentScrollY < lastScrollY;
      const nearTop = currentScrollY < 24;

      setIsHeaderVisible(nearTop || scrollingUp || isMobileMenuOpen);
      lastScrollY = currentScrollY;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await fetch(`${BACKEND_API}/auth/logout/`, { method: "POST", credentials: "include" });
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(USER_CACHE_KEY);
    }
    router.push("/accounts/login");
  };

  
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
    { href: "/carefree/calendar", label: "Kalendar", icon: CalendarDays },
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
        <header className="fixed inset-x-0 top-0 z-40 border-b bg-card/90 shadow-sm supports-[backdrop-filter]:backdrop-blur-md">
          <div className="container mx-auto h-20 flex items-center justify-between px-4">
          
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
          </div>
        </header>
        <main className="flex-1 w-full pt-24 p-6 space-y-4">
          <Skeleton className="h-12 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  
  return (
    <div
      className={`min-h-screen flex flex-col ${
        isCaretaker
          ? "bg-[#fafaf7]"
          : "bg-background"
      }`}
      data-theme={user?.role === "caretaker" ? "caretaker" : "student"}
    >
      
      
      <header
        className={`fixed inset-x-0 top-0 z-40 border-b bg-card/90 shadow-sm transition-transform duration-300 ease-out supports-[backdrop-filter]:backdrop-blur-md ${
          isHeaderVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          
          
          <Link href="/carefree/main" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative w-10 h-10">
              <Image 
                src="/images/logo.png" 
                alt="CareFree Logo" 
                fill
                className="object-contain"
              />
            </div>
            <span className="carefree-gradient text-2xl font-bold tracking-tight">CareFree</span>
          </Link>

          
          <nav className="hidden md:flex items-center gap-1 rounded-full border border-border bg-card p-1.5">
            {navigationLinks.map((link) => (
              <Link key={link.href} href={link.href} className={navLinkClass(link.href)}>
                <link.icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>

          
          <div className="flex items-center gap-2">
            {/* Hamburger Menu Button - Mobile Only */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden rounded-lg p-2 transition-colors hover:bg-secondary/70"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            {/* Profile Link */}
            <Link href={isCaretaker ? "/carefree/profile/caretaker" : "/carefree/profile/student"}>
              {(() => {
                const avatarAlt = user?.first_name || user?.email || "Moj Profil";
                const avatarCacheKey = isCaretaker
                  ? `avatar:self:${user?.id || user?.email || "anonymous"}`
                  : `avatar:layout:${user?.id || "anonymous"}`;

                return (
              <div className={`flex items-center gap-3 pl-1 pr-4 py-1 rounded-full border transition-all cursor-pointer group ${
                isActive("/carefree/profile") 
                  ? "border-primary bg-primary/5" 
                  : "border-transparent hover:bg-primary/5 hover:border-primary"
              }`}>
                <PersistentAvatar
                  cacheKey={avatarCacheKey}
                  src={isCaretaker ? user?.caretaker?.user_image_url : null}
                  alt={avatarAlt}
                  className="w-9 h-9 border-2 border-background shadow-sm group-hover:border-primary/50 transition-colors"
                  fallbackClassName="text-sm font-bold bg-primary/10 text-primary"
                  fallback={getInitials(user?.first_name, user?.last_name)}
                />
                
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors">
                    {user?.first_name ? user.first_name : "Moj Profil"}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {isCaretaker ? 'Psiholog' : 'Student'}
                  </p>
                </div>
              </div>
                );
              })()}
            </Link>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              title="Odjava"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Odjava</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="animate-in slide-in-from-top-2 duration-200 border-t bg-card/95 backdrop-blur-md md:hidden">
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {navigationLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive(link.href)
                      ? "bg-primary text-primary-foreground shadow-md font-bold"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-95"
                  }`}
                >
                  <link.icon className="w-5 h-5" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              ))}
              
              {/* Mobile Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95 border-t mt-2 pt-4"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Odjava</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full pt-24">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
