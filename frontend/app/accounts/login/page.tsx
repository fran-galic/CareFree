"use client";

import { LoginForm } from "@/components/login-form"
import { BACKEND_URL } from "@/lib/config"
import { useRouter } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isChecking, setIsChecking] = useState(true);

  const buildOnboardingPath = (user: { email?: string; auth_provider?: string; onboarding_token?: string | null }) => {
    if (user.auth_provider !== "google") {
      return "/accounts/signup";
    }

    const params = new URLSearchParams();
    params.set("google", "1");
    if (user.email) {
      params.set("email", user.email);
    }
    if (user.onboarding_token) {
      params.set("token", user.onboarding_token);
    }
    return `/accounts/signup?${params.toString()}`;
  };

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
        const response = await fetch(`${BACKEND_URL}/users/me/`, {
          credentials: "include",
        });
        
        if (response.ok) {
          const user = await response.json();
          router.replace(user.needs_onboarding ? buildOnboardingPath(user) : "/carefree/main");
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

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-muted-foreground">Učitavanje...</p>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
