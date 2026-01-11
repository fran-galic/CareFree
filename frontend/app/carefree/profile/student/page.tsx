"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, UserCircle, LogOut } from "lucide-react";
import { ProfileHeader } from "@/components/profile-header";

export default function StudentProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. DOHVAT PODATAKA
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status === 401) router.push("/accounts/login");
          return;
        }

        const data = await res.json();
        
        // Sigurnosna provjera - ako je zalutao psiholog, prebaci ga
        if (data.role === "caretaker") {
            router.push("/carefree/profile/caretaker");
            return;
        }

        setUser(data);
        if (data.student) {
          setFormData({
            studying_at: data.student.studying_at,
            year_of_study: data.student.year_of_study,
            is_anonymous: data.student.is_anonymous,
            about_me: data.student.about_me,
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  // 2. SPREMANJE
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/student/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studying_at: formData.studying_at,
          year_of_study: formData.year_of_study ? parseInt(formData.year_of_study) : null,
          about_me: formData.about_me,
          is_anonymous: formData.is_anonymous,
        }),
      });

      if (!res.ok) throw new Error("Update failed");
      setMessage({ type: "success", text: "Podaci uspješno spremljeni!" });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: "Greška pri spremanju." });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout/`, { method: "POST", credentials: "include" });
    router.push("/accounts/login");
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return null;

  return (
    <div className="container mx-auto py-12 max-w-5xl px-6">
      <ProfileHeader 
        firstName={user.first_name} 
        lastName={user.last_name} 
        email={user.email} 
        role="student"
      />
      <Separator className="mb-10 opacity-50" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Sidebar */}
        <div className="space-y-6">
            <h3 className="font-semibold text-lg">Postavke</h3>
            <Card>
                <CardContent className="pt-6 space-y-4">
                    <div><Label className="text-xs text-muted-foreground uppercase">Email</Label><div className="font-medium truncate">{user.email}</div></div>
                    <div><Label className="text-xs text-muted-foreground uppercase">Dob</Label><div className="font-medium">{user.age} god.</div></div>
                </CardContent>
            </Card>
            <div className="space-y-3">
                <Button onClick={handleSave} disabled={saving} className="w-full h-12">
                    {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />} Spremi
                </Button>
                <Button onClick={handleLogout} variant="outline" className="w-full h-12 text-destructive hover:bg-destructive/10">
                    <LogOut className="mr-2 h-4 w-4" /> Odjava
                </Button>
            </div>
            {message && <div className={`p-3 rounded text-sm text-center ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{message.text}</div>}
        </div>

        {/* Forma */}
        <div className="md:col-span-2 space-y-6">
            <div className="space-y-1">
                <h3 className="font-semibold text-xl flex items-center gap-2"><UserCircle className="w-5 h-5 text-primary" /> O meni</h3>
                <p className="text-sm text-muted-foreground">Podaci koji pomažu psiholozima da vas bolje razumiju.</p>
            </div>
            <Card>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Fakultet</Label>
                            <Input value={formData.studying_at || ""} onChange={e => setFormData({...formData, studying_at: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Godina studija</Label>
                            <Input type="number" value={formData.year_of_study || ""} onChange={e => setFormData({...formData, year_of_study: e.target.value})} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Biografija</Label>
                        <Textarea rows={5} value={formData.about_me || ""} onChange={e => setFormData({...formData, about_me: e.target.value})} className="resize-none" />
                    </div>
                    <Separator />
                    <div className="flex items-start space-x-3 pt-2">
                        <Checkbox checked={formData.is_anonymous} onCheckedChange={(c) => setFormData({...formData, is_anonymous: c})} />
                        <div className="grid gap-1.5">
                            <Label>Želim ostati anoniman</Label>
                            <p className="text-sm text-muted-foreground">Psiholozi neće vidjeti vaše ime, samo dob i spol.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}