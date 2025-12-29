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
    // Decode JWT token to extract email
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

    // Validation
    if (!formData.first_name || !formData.last_name || !formData.password || !formData.role) {
      setError("All fields are required");
      return;
    }

    // Student-specific validation
    if (formData.role === "student" && !formData.age) {
      setError("Age is required for students");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Register user
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
        setError(registerData.error || "Registration failed. Please try again.");
        return;
      }

      // Step 2: If student, login and update profile
      if (formData.role === "student") {
        // Login to get tokens
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

        // Update User age
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

        // Update Student studying_at
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

        // Redirect to dashboard or home
        router.push("/carefree/main");
      } else {
        // Caretaker - auto-login and redirect to profile edit
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

        // Redirect to profile edit
        router.push("/carefree/myprofile");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Your Registration</CardTitle>
          <CardDescription>
            {email && (
              <span className="block mt-1">
                Creating account for <span className="font-semibold text-foreground">{email}</span>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Label>I am a</Label>
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
                      ? "border-primary"
                      : "border-muted-foreground/30"
                  }`}>
                    {formData.role === "caretaker" && (
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                    )}
                  </div>
                  <span className="font-medium">Caretaker</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
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
                <Label htmlFor="last_name">Last Name</Label>
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
                  <Label htmlFor="age">Age</Label>
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
                  <Label htmlFor="studying_at">University / Faculty (Optional)</Label>
                  <Input
                    id="studying_at"
                    type="text"
                    value={formData.studying_at}
                    onChange={(e) => setFormData({ ...formData, studying_at: e.target.value })}
                    placeholder="e.g., FER, PMF..."
                    disabled={loading}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating Account..." : "Complete Registration"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
