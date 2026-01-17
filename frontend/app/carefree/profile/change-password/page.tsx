"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertCircle, CheckCircle } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    old_password: "",
    new_password: "",
    new_password2: "",
  });
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
              <Input
                id="old_password"
                type="password"
                value={formData.old_password}
                onChange={(e) => setFormData({ ...formData, old_password: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password">Nova lozinka</Label>
              <Input
                id="new_password"
                type="password"
                value={formData.new_password}
                onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                required
                disabled={loading}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">Minimalno 6 znakova</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password2">Potvrdi novu lozinku</Label>
              <Input
                id="new_password2"
                type="password"
                value={formData.new_password2}
                onChange={(e) => setFormData({ ...formData, new_password2: e.target.value })}
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
