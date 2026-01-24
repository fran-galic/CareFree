"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    old_password: "",
    new_password: "",
    new_password2: "",
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (formData.new_password !== formData.new_password2) {
      setMessage({ type: "error", text: "Nove lozinke se ne podudaraju" });
      return;
    }

    if (formData.new_password.length < 6) {
      setMessage({ type: "error", text: "Nova lozinka mora imati najmanje 6 znakova" });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/change-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          old_password: formData.old_password,
          new_password: formData.new_password,
          new_password2: formData.new_password2,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.old_password?.[0] || data.new_password?.[0] || "Greška pri promjeni lozinke");
      }

      setMessage({ type: "success", text: "Lozinka uspješno promijenjena!" });
      
      // Clear form
      setFormData({
        old_password: "",
        new_password: "",
        new_password2: "",
      });

      // Redirect to profile after 2 seconds
      setTimeout(() => {
        router.back();
      }, 2000);

    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Greška pri promjeni lozinke" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-12 max-w-md px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" /> Promjena lozinke
          </CardTitle>
          <CardDescription>
            Unesite svoju trenutnu lozinku i novu lozinku
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="old_password">Trenutna lozinka</Label>
              <div className="relative">
                <Input
                  id="old_password"
                  type={showOldPassword ? "text" : "password"}
                  value={formData.old_password}
                  onChange={(e) => setFormData({ ...formData, old_password: e.target.value })}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showOldPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password">Nova lozinka</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showNewPassword ? "text" : "password"}
                  value={formData.new_password}
                  onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                  required
                  disabled={loading}
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimalno 6 znakova</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password2">Potvrdi novu lozinku</Label>
              <div className="relative">
                <Input
                  id="new_password2"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.new_password2}
                  onChange={(e) => setFormData({ ...formData, new_password2: e.target.value })}
                  required
                  disabled={loading}
                  minLength={6}
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

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
                disabled={loading}
              >
                Odustani
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Spremam..." : "Promijeni lozinku"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
