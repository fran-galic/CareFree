"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface ConfirmRegistrationFormProps {
  token: string;
}

export function ConfirmRegistrationForm({ token }: ConfirmRegistrationFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    password: "",
    confirmPassword: "",
    role: "",
    age: "",
    sex: "",
    studying_at: "",
    year_of_study: "",
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

    
    if (formData.role === "student" && (!formData.age || !formData.sex)) {
      setError("Dob i spol su obavezni za studente");
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
        credentials: "include",
        body: JSON.stringify({
          token,
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
          role: formData.role,
          ...(formData.role === "student" && { age: parseInt(formData.age), sex: formData.sex }),
        }),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        setError(registerData.error || "Registracija nije uspjela. Pokušajte ponovno.");
        return;
      }

      // Check if this was a Google user - backend sets cookies and returns user data
      const isGoogleUser = registerData.user && registerData.access;
      
      if (isGoogleUser) {
        // Tokens already set in cookies by backend
        if (formData.role === "student") {
          const studentData: any = {};
          if (formData.age) studentData.age = parseInt(formData.age);
          if (formData.sex) studentData.sex = formData.sex;
          if (formData.studying_at) studentData.studying_at = formData.studying_at;
          if (formData.year_of_study) studentData.year_of_study = parseInt(formData.year_of_study);

          if (Object.keys(studentData).length > 0) {
            try {
              await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/register/student/`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  user_id: registerData.user.id,
                  ...studentData
                }),
              });
            } catch (err) {
              console.error("Failed to update student profile:", err);
            }
          }

          router.push("/carefree/main");
        } else {
          router.push("/carefree/profile/caretaker");
        }
        return;
      }

      // Regular email/password user - need to login
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
          setError("Registracija uspješna, ali automatska prijava nije uspjela. Prijavite se ručno.");
          router.push("/accounts/login");
          return;
        }

        const loginData = await loginResponse.json();

        // Call the new student registration endpoint
        const studentData: any = {};
        if (formData.age) studentData.age = parseInt(formData.age);
        if (formData.sex) studentData.sex = formData.sex;
        if (formData.studying_at) studentData.studying_at = formData.studying_at;
        if (formData.year_of_study) studentData.year_of_study = parseInt(formData.year_of_study);

        if (Object.keys(studentData).length > 0 && loginData.user?.id) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/register/student/`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                user_id: loginData.user.id,
                ...studentData
              }),
            });
          } catch (err) {
            console.error("Failed to update student profile:", err);
          }
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

        
        router.push("/carefree/profile/caretaker");
      }
    } catch {
      setError("Greška u mreži. Pokušajte ponovno.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg">
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

            <div className="transition-all duration-500 ease-in-out overflow-hidden">
              {formData.role === "student" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="grid grid-cols-2 gap-4">
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
                      <Label htmlFor="sex">Spol</Label>
                      <select
                        id="sex"
                        value={formData.sex}
                        onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                        required
                        disabled={loading}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Odaberite...</option>
                        <option value="M">Muški</option>
                        <option value="F">Ženski</option>
                        <option value="O">Ne želim reći</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="studying_at">Fakultet (Opcionalno)</Label>
                      <Input
                        id="studying_at"
                        type="text"
                        value={formData.studying_at}
                        onChange={(e) => setFormData({ ...formData, studying_at: e.target.value })}
                        placeholder="npr. FER, PMF..."
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year_of_study">Godina studija (Opcionalno)</Label>
                      <Input
                        id="year_of_study"
                        type="number"
                        min="1"
                        max="12"
                        value={formData.year_of_study}
                        onChange={(e) => setFormData({ ...formData, year_of_study: e.target.value })}
                        placeholder=""
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Lozinka</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Potvrdite lozinku</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className={`w-full transition-all duration-300 ${
                formData.role === "student" 
                  ? "bg-[oklch(0.783_0.1136_182.2)] hover:bg-[oklch(0.783_0.1136_182.2)]/90 text-white shadow-lg" 
                  : formData.role === "caretaker"
                  ? "bg-[oklch(0.68_0.20_45)] hover:bg-[oklch(0.68_0.20_45)]/90 text-white shadow-lg"
                  : "bg-gradient-to-r from-[oklch(0.783_0.1136_182.2)] to-[oklch(0.68_0.20_45)] hover:opacity-90"
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
