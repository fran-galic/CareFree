"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertCircle, CheckCircle } from "lucide-react";
import React from "react";

export default function ResetPasswordPage({ params }: { params: Promise<{ uidb64: string; token: string }> }) {
  const { uidb64, token } = React.use(params);
  const router = useRouter();
  const [formData, setFormData] = useState({
    password: "",
    repeatPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/`, {
          credentials: "include",
        });
        
        if (response.ok) {
          // User is already logged in, redirect to main page
          router.replace("/carefree/main");
        } else {
          setIsChecking(false);
        }
      } catch {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (formData.password !== formData.repeatPassword) {
      setMessage({ type: "error", text: "Lozinke se ne podudaraju" });
      return;
    }

    if (formData.password.length < 6) {
      setMessage({ type: "error", text: "Lozinka mora imati najmanje 6 znakova" });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/reset-password/${uidb64}/${token}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: formData.password,
          repeatPassword: formData.repeatPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Greška pri resetiranju lozinke");
      }

      setMessage({ type: "success", text: "Lozinka uspješno resetirana! Preusmjeravam na prijavu..." });
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/accounts/login");
      }, 2000);

    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Greška pri resetiranju lozinke" });
    } finally {
      setLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Provjera prijave...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" /> Resetiranje lozinke
          </CardTitle>
          <CardDescription>
            Unesite novu lozinku za svoj račun
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova lozinka</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">Minimalno 6 znakova</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repeatPassword">Potvrdi lozinku</Label>
              <Input
                id="repeatPassword"
                type="password"
                value={formData.repeatPassword}
                onChange={(e) => setFormData({ ...formData, repeatPassword: e.target.value })}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            {message && (
              <Alert variant={message.type === "error" ? "destructive" : "default"} className={message.type === "success" ? "border-green-500 bg-green-50" : ""}>
                {message.type === "error" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                <AlertDescription className={message.type === "success" ? "text-green-800" : ""}>
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Resetiram..." : "Resetiraj lozinku"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
