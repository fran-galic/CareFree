"use client";

import { LoginForm } from "@/components/login-form"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isChecking, setIsChecking] = useState(true);
  const registrationMessage = useMemo(() => {
    if (searchParams.get("registered") !== "1") {
      return null;
    }

    return "Racun je uspjesno aktiviran. Prijavite se kako biste nastavili koristiti CareFree.";
  }, [searchParams]);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/`, {
          credentials: "include",
        });
        
        if (response.ok) {
          const user = await response.json();
          router.replace(user.needs_onboarding ? "/accounts/signup" : "/carefree/main");
        } else {
          setIsChecking(false);
        }
      } catch {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isChecking) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Provjera prijave...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm registrationMessage={registrationMessage} />
      </div>
    </div>
  )
}
