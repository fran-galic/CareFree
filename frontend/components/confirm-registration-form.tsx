"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ConfirmRegistrationFormProps {
  token: string;
}

export function ConfirmRegistrationForm({ token }: ConfirmRegistrationFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    password: "",
    confirmPassword: "",
    role: "",
    age: "",
    studying_at: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setEmail(payload.email || "");
    } catch (err) {
      console.error("Failed to decode token:", err);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    
    if (!formData.first_name || !formData.last_name || !formData.password || !formData.role) {
      setError("Sva polja su obavezna");
      return;
    }

    
    if (formData.role === "student" && !formData.age) {
      setError("Dob je obavezna za studente");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Lozinke se ne podudaraju");
      return;
    }

    if (formData.password.length < 8) {
      setError("Lozinka mora imati najmanje 8 znakova");
      return;
    }

    setLoading(true);

    try {
      
      const registerResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/register/confirm/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
          role: formData.role,
        }),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        setError(registerData.error || "Registracija nije uspjela. Pokušajte ponovno.");
        return;
      }

      
      if (formData.role === "student") {
        
        const loginResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/login/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email,
            password: formData.password,
          }),
        });

        if (!loginResponse.ok) {
          setError("Registration successful but auto-login failed. Please login manually.");
          router.push("/accounts/login");
          return;
        }

        const loginData = await loginResponse.json();
        const accessToken = loginData.access;

        
        if (formData.age) {
          await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            credentials: "include",
            body: JSON.stringify({
              age: parseInt(formData.age),
            }),
          });
        }

        
        if (formData.studying_at) {
          await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/student/`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            credentials: "include",
            body: JSON.stringify({
              studying_at: formData.studying_at,
            }),
          });
        }

        
        router.push("/carefree/main");
      } else {
        
        const loginResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/login/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email,
            password: formData.password,
          }),
        });

        if (!loginResponse.ok) {
          setError("Registracija uspješna, ali automatska prijava nije uspjela. Prijavite se ručno.");
          router.push("/accounts/login");
          return;
        }

        
        router.push("/carefree/myprofile");
      }
    } catch (err) {
      setError("Greška u mreži. Pokušajte ponovno.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Dovršite registraciju</CardTitle>
          <CardDescription>
            {email && (
              <span className="block mt-1">
                Stvaranje računa za <span className="font-semibold text-foreground">{email}</span>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Label>Ja sam</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: "student" })}
                  className="flex items-center gap-3 w-full p-4 border-2 rounded-lg transition-all hover:bg-muted/50"
                  disabled={loading}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    formData.role === "student"
                      ? "border-primary"
                      : "border-muted-foreground/30"
                  }`}>
                    {formData.role === "student" && (
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                    )}
                  </div>
                  <span className="font-medium">Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: "caretaker" })}
                  className="flex items-center gap-3 w-full p-4 border-2 rounded-lg transition-all hover:bg-muted/50"
                  disabled={loading}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    formData.role === "caretaker"
                      ? "border-orange-500"
                      : "border-muted-foreground/30"
                  }`}>
                    {formData.role === "caretaker" && (
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    )}
                  </div>
                  <span className="font-medium">Psiholog</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Ime</Label>
                <Input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Prezime</Label>
                <Input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {formData.role === "student" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="age">Dob</Label>
                  <Input
                    id="age"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studying_at">Sveučilište / Fakultet (Opcionalno)</Label>
                  <Input
                    id="studying_at"
                    type="text"
                    value={formData.studying_at}
                    onChange={(e) => setFormData({ ...formData, studying_at: e.target.value })}
                    placeholder="npr. FER, PMF..."
                    disabled={loading}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Lozinka</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Potvrdite lozinku</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className={`w-full ${
                formData.role === "caretaker" 
                  ? "bg-orange-500 hover:bg-orange-600" 
                  : ""
              }`}
              disabled={loading}
            >
              {loading ? "Kreiranje računa..." : "Dovršite registraciju"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
