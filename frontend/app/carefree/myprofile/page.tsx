"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge"; 
import { Loader2, Save, UserCircle, LogOut } from "lucide-react"; // DODANO: LogOut ikona

// Tipovi podataka prema backendu
interface UserData {
  id: string;
  email: string;
  first_name?: string; 
  last_name?: string;
  role: "student" | "caretaker";
  sex: string;
  age: number;
  caretaker?: CaretakerData;
  student?: StudentData;
}

interface StudentData {
  studying_at: string;
  year_of_study: number;
  is_anonymous: boolean;
  about_me: string;
}

interface CaretakerData {
  academic_title: string;
  specialisation: string;
  working_since: number;
  tel_num: string;
  office_address: string;
  about_me: string;
  help_categories: string[];
  user_image_url: string | null;
}

export default function MyProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Stanje forme
  const [formData, setFormData] = useState<any>({});

  // 1. DOHVAĆANJE PODATAKA
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status === 401) router.push("/accounts/login");
          throw new Error("Failed to load profile");
        }

        const data = await res.json();
        setUser(data);

        // Inicijalno punjenje forme
        if (data.role === "student" && data.student) {
          setFormData({
            ...data.student,
            first_name: data.first_name,
            last_name: data.last_name,
          });
        } else if (data.role === "caretaker" && data.caretaker) {
          setFormData({
            ...data.caretaker,
            first_name: data.first_name,
            last_name: data.last_name,
          });
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [router]);

  // 2. FUNKCIJA ZA SPREMANJE
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      let endpoint = "";
      let bodyData = {};

      if (user?.role === "student") {
        endpoint = `${backendUrl}/users/me/student/`;
        bodyData = {
          studying_at: formData.studying_at,
          year_of_study: formData.year_of_study ? parseInt(formData.year_of_study) : null,
          about_me: formData.about_me,
          is_anonymous: formData.is_anonymous,
        };
      } else if (user?.role === "caretaker") {
        endpoint = `${backendUrl}/users/me/caretaker/`;
        bodyData = {
          about_me: formData.about_me,
          specialisation: formData.specialisation,
          tel_num: formData.tel_num,
          office_address: formData.office_address,
          academic_title: formData.academic_title,
          working_since: formData.working_since ? parseInt(formData.working_since) : null,
        };
      }

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) throw new Error("Failed to update profile");

      setMessage({ type: "success", text: "Promjene su uspješno spremljene!" });
      
      setTimeout(() => {
         router.refresh(); 
      }, 1000);

    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Došlo je do greške prilikom spremanja." });
    } finally {
      setSaving(false);
    }
  };

  // 3. NOVO: FUNKCIJA ZA ODJAVU (LOGOUT)
  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout/`, {
        method: "POST",
        credentials: "include",
      });
      // Bez obzira na odgovor servera, preusmjeravamo na login
      router.push("/accounts/login");
    } catch (error) {
      console.error("Logout failed:", error);
      router.push("/accounts/login");
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center flex-col gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <p className="text-muted-foreground">Učitavanje vašeg profila...</p>
    </div>
  );

  if (!user) return null;

  const isCaretaker = user.role === "caretaker";

  const displayName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user.first_name 
      ? user.first_name 
      : "Moj Profil";

  return (
    <div className="container mx-auto py-12 max-w-5xl px-6 animate-in fade-in duration-500">
      
      {/* --- HEADER --- */}
      <div className="mb-12 flex flex-col md:flex-row items-center md:items-start gap-8">
        <Avatar className="w-32 h-32 border-4 border-background shadow-xl ring-1 ring-muted">
          <AvatarImage 
            src={isCaretaker ? user.caretaker?.user_image_url || "" : ""} 
            className="object-cover"
          />
          <AvatarFallback className={`text-6xl font-bold ${isCaretaker ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
            {isCaretaker ? "P" : "S"}
          </AvatarFallback>
        </Avatar>

        <div className="text-center md:text-left space-y-3 pt-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            {displayName}
          </h1>
          
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-muted-foreground">
            <Badge variant={isCaretaker ? "default" : "secondary"} className={isCaretaker ? "bg-orange-500 hover:bg-orange-600" : ""}>
              {isCaretaker ? "Psiholog" : "Student"}
            </Badge>
            <span className="text-sm">•</span>
            <span className="text-sm font-medium">{user.email}</span>
            {isCaretaker && formData.academic_title && (
              <>
                <span className="text-sm">•</span>
                <span className="text-sm font-medium">{formData.academic_title}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <Separator className="mb-10 opacity-50" />

      {/* --- GLAVNI GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        
        {/* LIJEVA STRANA - POSTAVKE & AKCIJE */}
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">Postavke računa</h3>
            <p className="text-sm text-muted-foreground">
              Upravljajte svojim podacima i sesijom.
            </p>
          </div>
          
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Email</Label>
                <div className="font-medium truncate">{user.email}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Dob</Label>
                  <div className="font-medium">{user.age} god.</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Spol</Label>
                  <div className="font-medium">{user.sex === 'M' ? 'Muško' : user.sex === 'F' ? 'Žensko' : 'Drugo'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* GUMBI ZA AKCIJE */}
          <div className="space-y-3">
            <Button 
              onClick={handleSave} 
              disabled={saving} 
              className={`w-full h-12 text-base shadow-sm transition-all ${isCaretaker ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              {saving ? "Spremanje..." : "Spremi promjene"}
            </Button>

            {/* NOVO: LOGOUT GUMB */}
            <Button 
              onClick={handleLogout} 
              variant="outline"
              className="w-full h-12 text-base hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Odjavi se
            </Button>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-center text-sm font-medium animate-in zoom-in ${
              message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        {/* DESNA STRANA - FORMA (Ostaje ista) */}
        <div className="md:col-span-2 space-y-8">
          
          {/* STUDENTA FORMA */}
          {!isCaretaker && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-1">
                <h3 className="font-semibold text-xl flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-primary" /> 
                  O meni
                </h3>
                <p className="text-sm text-muted-foreground">
                  Podaci koji pomažu psiholozima da vas bolje razumiju.
                </p>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="studying_at">Fakultet / Učilište</Label>
                      <Input 
                        id="studying_at" 
                        value={formData.studying_at || ""} 
                        onChange={(e) => handleChange("studying_at", e.target.value)}
                        placeholder="npr. FER, Filozofski..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year_of_study">Godina studija</Label>
                      <Input 
                        id="year_of_study" 
                        type="number" 
                        min={1} max={10}
                        value={formData.year_of_study || ""} 
                        onChange={(e) => handleChange("year_of_study", e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="about_me">Biografija</Label>
                    <Textarea 
                      id="about_me"
                      value={formData.about_me || ""}
                      onChange={(e) => handleChange("about_me", e.target.value)}
                      placeholder="Što studirate? Koji su vam interesi? Što vas muči?"
                      rows={5}
                      className="resize-none bg-muted/20"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-start space-x-3 pt-2">
                    <Checkbox 
                      id="is_anonymous" 
                      checked={formData.is_anonymous}
                      onCheckedChange={(checked) => handleChange("is_anonymous", checked)}
                      className="mt-1"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="is_anonymous" className="text-base font-medium cursor-pointer">
                        Želim ostati anoniman
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Vaše ime i prezime bit će skriveni psiholozima. Vidjet će samo vašu dob i spol.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* PSIHOLOG FORMA */}
          {isCaretaker && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-1">
                <h3 className="font-semibold text-xl text-orange-700">Profesionalni podaci</h3>
                <p className="text-sm text-muted-foreground">
                  Uredite kako vas vide studenti.
                </p>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="academic_title">Akademska titula</Label>
                      <Input 
                        id="academic_title" 
                        value={formData.academic_title || ""} 
                        onChange={(e) => handleChange("academic_title", e.target.value)}
                        placeholder="npr. mag. psych."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialisation">Specijalizacija</Label>
                      <Input 
                        id="specialisation" 
                        value={formData.specialisation || ""} 
                        onChange={(e) => handleChange("specialisation", e.target.value)}
                        placeholder="npr. KBT, Gestalt..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="about_me">O meni (Javni opis)</Label>
                    <Textarea 
                      id="about_me" 
                      value={formData.about_me || ""} 
                      onChange={(e) => handleChange("about_me", e.target.value)}
                      placeholder="Opišite svoj pristup radu..."
                      rows={6}
                      className="resize-none bg-muted/20"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="tel_num">Kontakt Telefon <span className="text-red-400">*</span></Label>
                      <Input 
                        id="tel_num" 
                        value={formData.tel_num || ""} 
                        onChange={(e) => handleChange("tel_num", e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">Vidljivo samo administratorima.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="office_address">Adresa ureda</Label>
                      <Input 
                        id="office_address" 
                        value={formData.office_address || ""} 
                        onChange={(e) => handleChange("office_address", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}