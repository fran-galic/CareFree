"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, UserCircle, LogOut } from "lucide-react";
import { ProfileHeader } from "@/components/profile-header";

export default function CaretakerProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  
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
        
        
        if (data.role === "student") {
            router.push("/carefree/profile/student");
            return;
        }

        setUser(data);
        if (data.caretaker) {
          setFormData({
            tel_num: data.caretaker.tel_num,
            about_me: data.caretaker.about_me,
            grad_year: data.caretaker.grad_year,
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

  
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/caretaker/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tel_num: formData.tel_num,
          about_me: formData.about_me,
          grad_year: formData.grad_year ? parseInt(formData.grad_year) : null,
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
    <div className="container mx-auto py-12 max-w-5xl px-6" data-theme="caretaker">
      <ProfileHeader 
        firstName={user.first_name} 
        lastName={user.last_name} 
        email={user.email} 
        role="caretaker"
      />
      <Separator className="mb-10 opacity-50" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        
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

        
        <div className="md:col-span-2 space-y-6">
            <div className="space-y-1">
                <h3 className="font-semibold text-xl flex items-center gap-2"><UserCircle className="w-5 h-5 text-primary" /> O meni</h3>
                <p className="text-sm text-muted-foreground">Osnovni podaci o vašem profilu.</p>
            </div>
            <Card>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Telefon</Label>
                            <Input value={formData.tel_num || ""} onChange={e => setFormData({...formData, tel_num: e.target.value})} placeholder="+385 ..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Godina diplomiranja</Label>
                            <Input type="number" value={formData.grad_year || ""} onChange={e => setFormData({...formData, grad_year: e.target.value})} placeholder="npr. 2020" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>O meni</Label>
                        <Textarea rows={5} value={formData.about_me || ""} onChange={e => setFormData({...formData, about_me: e.target.value})} className="resize-none" placeholder="Opišite svoje radno iskustvo i pristup radu..." />
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
