"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import GoogleAuthButton from "@/components/google-auth-button";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm({
  className,
  registrationMessage,
  ...props
}: React.ComponentProps<"div"> & { registrationMessage?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || "Prijava nije uspjela.");
      }

      const data = await response.json();

      // Successfully logged in - wait a moment for cookies to be set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use window.location for a full page reload to ensure cookies are properly set
      window.location.href = data.user?.needs_onboarding ? "/accounts/signup" : "/carefree/main";
    } catch (error) {
      setError((error as Error).message || "Prijava nije uspjela.");
      setLoading(false);
    }
  };


  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Prijavite se na svoj račun</CardTitle>
          <CardDescription>
            Unesite svoj email za prijavu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registrationMessage ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {registrationMessage}
            </div>
          ) : null}
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="ime@primjer.com"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Lozinka</FieldLabel>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Zaboravili ste lozinku?
                  </Link> 
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
              <Field>
                <Button type="submit" disabled={loading} className="bg-gradient-to-r from-[oklch(0.783_0.1136_182.2)] to-[oklch(0.68_0.20_45)] hover:opacity-90 transition-opacity">Prijavi se</Button>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <FieldDescription className="text-center">
                  Nemate račun? <Link href="./signup" className="underline">Registrirajte se</Link>
                </FieldDescription>
              </Field>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    ili
                  </span>
                </div>
              </div>
              <Field>
                <GoogleAuthButton text="Prijavi se s Google-om" onError={setError} />
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
