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

// Definiramo tipove podataka točno kako ih backend vraća
interface UserData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "student" | "caretaker";
  sex: string;
  age: number;
  caretaker?: CaretakerData;
  student?: StudentData;
}

interface StudentData {
  studying_at: string;
  year_of_study: number;
  is_anonymous: boolean;     // Traženo u dokumentaciji
  about_me: string;          // Traženo u dokumentaciji
}

interface CaretakerData {
  academic_title: string;    // Traženo: titula
  specialisation: string;
  working_since: number;     // Traženo: godina početka rada
  tel_num: string;           // Traženo: privatni telefon
  office_address: string;    // Traženo: adresa ureda
  about_me: string;          // Traženo: profesionalni opis
  help_categories: string[]; // Traženo: kategorije
  user_image_url: string | null;
}

export default function MyProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Stanje forme (objedinjuje sva polja koja se mogu mijenjati)
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

        // Popunjavanje forme ovisno o ulozi
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

  // 2. FUNKCIJA ZA SPREMANJE I POVRATAK
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      let endpoint = "";
      let bodyData = {};

      // Priprema podataka za slanje
      if (user?.role === "student") {
        endpoint = `${backendUrl}/users/me/student/`;
        bodyData = {
            studying_at: formData.studying_at,
            year_of_study: formData.year_of_study ? parseInt(formData.year_of_study) : null,
            about_me: formData.about_me,
            // Šaljemo i is_anonymous iako ga trenutni backend serializer možda ignorira
            is_anonymous: formData.is_anonymous, 
        };
      } else if (user?.role === "caretaker") {
        endpoint = `${backendUrl}/users/me/caretaker/`;
        bodyData = {
            about_me: formData.about_me,
            specialisation: formData.specialisation,
            tel_num: formData.tel_num,
            // Šaljemo i ove podatke iako ih trenutni backend serializer možda ignorira
            office_address: formData.office_address,
            academic_title: formData.academic_title,
        };
      }

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) throw new Error("Failed to update profile");

      // Uspjeh
      setMessage({ type: "success", text: "Profil ažuriran! Preusmjeravam..." });
      
      // Čekamo 1.5 sekundu da korisnik vidi poruku, pa vraćamo na glavnu
      setTimeout(() => {
        router.push("/carefree/main");
      }, 1500);
      
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Došlo je do greške prilikom spremanja." });
      setSaving(false); // Samo ako je greška gasimo saving, inače ostaje dok ne preusmjeri
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Učitavanje...</div>;
  if (!user) return <div className="flex h-screen items-center justify-center">Niste prijavljeni.</div>;

  return (
    <div className="container mx-auto py-10 max-w-4xl px-4">
      
      {/* --- GLAVNA KARTICA KORISNIKA --- */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-8 p-6 bg-card rounded-xl border shadow-sm">
        <Avatar className="w-32 h-32 border-4 border-primary/10">
            {/* Prikazujemo sliku samo ako je caretaker i ima url, inače inicijali */}
            <AvatarImage src={user.role === 'caretaker' ? user.caretaker?.user_image_url || "" : ""} />
            <AvatarFallback className="text-4xl bg-primary/10 text-primary font-bold">
                {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
            </AvatarFallback>
        </Avatar>
        <div className="text-center md:text-left space-y-2">
            <h1 className="text-3xl font-bold">{user.first_name} {user.last_name}</h1>
            <div className="flex flex-col md:flex-row gap-2 items-center justify-center md:justify-start text-muted-foreground">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium capitalize">
                    {user.role === 'caretaker' ? 'Psiholog' : 'Student'}
                </span>
                <span className="text-sm">{user.email}</span>
            </div>
            {user.role === 'caretaker' && (
                <p className="text-sm font-medium text-muted-foreground">
                   {formData.academic_title} {formData.working_since ? `• Radi od: ${formData.working_since}.` : ""}
                </p>
            )}
        </div>
      </div>

      <div className="grid gap-6">
        
        {/* --- SEKCIJA ZA STUDENTE --- */}
        {user.role === "student" && (
            <Card>
                <CardHeader>
                    <CardTitle>Podaci o studiju</CardTitle>
                    <CardDescription>Ovi podaci pomažu psiholozima da bolje razumiju vaš kontekst.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="studying_at">Fakultet / Učilište</Label>
                            <Input 
                                id="studying_at" 
                                value={formData.studying_at || ""} 
                                onChange={(e) => handleChange("studying_at", e.target.value)}
                                placeholder="npr. Filozofski fakultet"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="year_of_study">Godina studija</Label>
                            <Input 
                                id="year_of_study" 
                                type="number" 
                                min={1} max={12}
                                value={formData.year_of_study || ""} 
                                onChange={(e) => handleChange("year_of_study", e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="about_me">O meni</Label>
                        <Textarea 
                            id="about_me"
                            value={formData.about_me || ""}
                            onChange={(e) => handleChange("about_me", e.target.value)}
                            placeholder="Kratko se predstavite (hobiji, interesi, razlog prijave)..."
                            rows={3}
                        />
                    </div>

                    <Separator />
                    
                    {/* ANONIMNOST (Traženo u dokumentaciji) */}
                    <div className="flex items-start space-x-3 p-4 bg-secondary/20 rounded-lg border border-secondary">
                        <Checkbox 
                            id="is_anonymous" 
                            checked={formData.is_anonymous}
                            onCheckedChange={(checked) => handleChange("is_anonymous", checked)}
                            className="mt-1"
                        />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor="is_anonymous" className="text-base font-semibold cursor-pointer">
                                Želim ostati anoniman
                            </Label>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Ako je ovo uključeno, psiholozima će biti vidljivi <strong>samo vaša dob i spol</strong>. 
                                Ime i prezime bit će skriveni.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}

        {/* --- SEKCIJA ZA PSIHOLOGE (CARETAKER) --- */}
        {user.role === "caretaker" && (
             <Card>
             <CardHeader>
                 <CardTitle>Profesionalni profil</CardTitle>
                 <CardDescription>Uredite informacije koje studenti vide o vama.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
                 
                 <div className="grid md:grid-cols-2 gap-4">
                     {/* Titula - Traženo u dokumentaciji */}
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
                     <Label htmlFor="about_me">O meni (Vaš opis za studente)</Label>
                     <Textarea 
                         id="about_me" 
                         className="min-h-[120px]"
                         value={formData.about_me || ""} 
                         onChange={(e) => handleChange("about_me", e.target.value)}
                         placeholder="Napišite nešto o svom pristupu, iskustvu i načinu rada..."
                     />
                     <p className="text-xs text-muted-foreground">Ovaj tekst je ključan studentima pri odabiru psihologa.</p>
                 </div>

                 <Separator />

                 <div className="grid md:grid-cols-2 gap-4">
                    {/* Telefon - Traženo da bude privatan */}
                    <div className="space-y-2">
                         <Label htmlFor="tel_num">Broj mobitela</Label>
                         <Input 
                             id="tel_num" 
                             value={formData.tel_num || ""} 
                             onChange={(e) => handleChange("tel_num", e.target.value)}
                         />
                         <p className="text-[11px] text-red-500 font-medium">Vidljivo samo administratorima (Privatno).</p>
                     </div>
                     {/* Adresa ureda - Traženo u dokumentaciji */}
                     <div className="space-y-2">
                         <Label htmlFor="office_address">Adresa ureda</Label>
                         <Input 
                             id="office_address" 
                             value={formData.office_address || ""} 
                             onChange={(e) => handleChange("office_address", e.target.value)}
                             placeholder="Ulica i broj, Grad"
                         />
                     </div>
                 </div>

                 {/* Kategorije - Samo prikaz (jer se biraju pri registraciji ili admin panelu) */}
                 <div className="space-y-3 pt-2">
                     <Label>Moje kategorije pomoći</Label>
                     <div className="flex flex-wrap gap-2">
                         {formData.help_categories?.map((cat: string) => (
                             <span key={cat} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                                 {cat}
                             </span>
                         ))}
                         {(!formData.help_categories || formData.help_categories.length === 0) && 
                            <span className="text-sm text-muted-foreground italic">Nema odabranih kategorija</span>
                         }
                     </div>
                 </div>

             </CardContent>
         </Card>
        )}

        {/* --- AKCIJE (SPREMANJE I POVRATAK) --- */}
        <div className="flex flex-col gap-4 pb-10">
            {message && (
                <div className={`p-4 rounded-md flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-2 ${
                    message.type === 'success' 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}
            
            <div className="flex justify-end gap-4">
                {/* Gumb za povratak na glavnu stranicu */}
                <Button 
                    variant="outline" 
                    onClick={() => router.push("/carefree/main")}
                    disabled={saving}
                >
                    Natrag na glavnu
                </Button>
                
                {/* Gumb za spremanje */}
                <Button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="min-w-[150px]"
                >
                    {saving ? "Spremanje..." : "Spremi promjene"}
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
