"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  LogOut, 
  Key, 
  Trash, 
  Mail, 
  Calendar, 
  GraduationCap, 
  BookOpen,
  User,
  EyeOff,
  Eye,
  Shield,
  Settings,
  UserPen,
  Save
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function StudentProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "actions">("info");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    age: "",
    sex: "" as "" | "M" | "F" | "O",
    studying_at: "",
    year_of_study: "",
  });

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
        
        if (data.role === "caretaker") {
          router.push("/carefree/profile/caretaker");
          return;
        }

        setUser(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    setForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      age: user.age ? String(user.age) : "",
      sex: user.sex ?? "",
      studying_at: user.student?.studying_at ?? "",
      year_of_study: user.student?.year_of_study ? String(user.student.year_of_study) : "",
    });
  }, [user]);

  const handleCancelEdit = () => {
    setIsEditing(false);
    // reset form back to current user state
    setForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      age: user.age ? String(user.age) : "",
      sex: user.sex ?? "",
      studying_at: user.student?.studying_at ?? "",
      year_of_study: user.student?.year_of_study ? String(user.student.year_of_study) : "",
    });
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      // Update User fields
      const userPayload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        age: form.age ? Number(form.age) : null,
        sex: form.sex || null,
      };

      const userRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(userPayload),
      });

      if (!userRes.ok) {
        const err = await userRes.json().catch(() => ({}));
        alert(err.detail || err.error || "Greška pri spremanju korisničkih podataka.");
        return;
      }

      // Update Student fields
      const studentPayload = {
        studying_at: form.studying_at.trim() || null,
        year_of_study: form.year_of_study ? Number(form.year_of_study) : null,
      };

      const studentRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/student/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(studentPayload),
      });

      if (!studentRes.ok) {
        const err = await studentRes.json().catch(() => ({}));
        alert(err.detail || err.error || "Greška pri spremanju studentskih podataka.");
        return;
      }

      // Refresh user data from /users/me/
      const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (refreshRes.ok) {
        const updated = await refreshRes.json();
        setUser(updated);
      }

      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("Greška pri spremanju promjena. Molimo pokušajte ponovno.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout/`, { method: "POST", credentials: "include" });
    router.push("/accounts/login");
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/delete/`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        router.push("/accounts/login");
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Delete account error:", response.status, errorData);
        alert(`Greška pri brisanju računa: ${errorData.error || errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error("Delete account exception:", error);
      alert("Greška pri brisanju računa. Molimo pokušajte ponovno.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }
  
  if (!user) return null;

  const student = user.student;
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'S';

  return (
    <div className="min-h-screen bg-background" data-theme="student">
      <div className="container mx-auto py-6 px-4 max-w-6xl pb-8">
        
        {/* Kompaktni Header */}
        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-24 h-24 border-2 border-primary/20 shadow-lg">
            <AvatarFallback className="text-3xl font-bold bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {user.first_name} {user.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                <GraduationCap className="w-3 h-3 mr-1" />
                Student
              </Badge>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "info" | "actions")} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="info" className="gap-2">
                <User className="w-4 h-4" />
                Osobni podaci
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2">
                <Settings className="w-4 h-4" />
                Akcije
              </TabsTrigger>
            </TabsList>

            {activeTab === "info" && (
              !isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  { "Uredi" }
                  <UserPen />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                    Odustani
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                    { "Spremi" }
                    <Save />
                  </Button>
                </div>
              )
            )}
          </div>

          <TabsContent value="info" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Osnovne informacije - kompaktno */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Osnovne informacije</CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {!isEditing ? (
                    <>
                      <DataRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
                      <Separator />
                      <DataRow icon={<Calendar className="w-4 h-4" />} label="Dob" value={user.age ? `${user.age} god.` : "—"} />
                      <Separator />
                      <DataRow
                        icon={<User className="w-4 h-4" />}
                        label="Spol"
                        value={user.sex === "M" ? "Muški" : user.sex === "F" ? "Ženski" : user.sex === "O" ? "Ne želim reći" : "—"}
                      />
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Ime</Label>
                          <Input
                            value={form.first_name}
                            onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label>Prezime</Label>
                          <Input
                            value={form.last_name}
                            onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Dob</Label>
                          <Input
                            type="number"
                            value={form.age}
                            onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label>Spol</Label>
                          <Select value={form.sex} onValueChange={(v) => setForm((p) => ({ ...p, sex: v as any }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Odaberi" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Muški</SelectItem>
                              <SelectItem value="F">Ženski</SelectItem>
                              <SelectItem value="O">Ne želim reći</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Akademske informacije */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Akademske informacije</CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {!isEditing ? (
                    <>
                      <DataRow icon={<BookOpen className="w-4 h-4" />} label="Fakultet" value={student?.studying_at || "—"} />
                      <Separator />
                      <DataRow
                        icon={<GraduationCap className="w-4 h-4" />}
                        label="Godina studija"
                        value={student?.year_of_study ? `${student.year_of_study}. godina` : "—"}
                      />
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Label>Fakultet</Label>
                        <Input
                          value={form.studying_at}
                          onChange={(e) => setForm((p) => ({ ...p, studying_at: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label>Godina studija</Label>
                        <Input
                          type="number"
                          value={form.year_of_study}
                          onChange={(e) => setForm((p) => ({ ...p, year_of_study: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4 mt-0">
            {!showDeleteConfirm ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Upravljanje računom</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Ovdje možete upravljati postavkama svog računa, promijeniti lozinku ili se odjaviti.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Sesija */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Sesija</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Odjavom ćete biti preusmjereni na stranicu za prijavu. Vaši podaci ostaju sigurno pohranjeni i možete se vratiti bilo kada.
                    </p>
                    <Button 
                      onClick={handleLogout} 
                      variant="outline" 
                      className="w-full justify-start h-11 text-destructive hover:text-destructive hover:bg-destructive/5"
                    >
                      <LogOut className="mr-2 h-4 w-4" /> Odjavi se
                    </Button>
                  </div>

                  <Separator />

                  {/* Sigurnost */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Sigurnost</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Redovito ažuriranje lozinke pomaže u zaštiti vašeg računa. Preporučujemo korištenje snažne lozinke s kombinacijom velikih i malih slova, brojeva i simbola.
                    </p>
                    <Button 
                      onClick={() => router.push("/carefree/profile/change-password")} 
                      variant="outline" 
                      className="w-full justify-start h-11"
                    >
                      <Key className="mr-2 h-4 w-4" /> Promijeni lozinku
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  {/* Opasna zona */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-destructive">Brisanje računa</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Trajno brisanje vašeg računa znači da će svi vaši podaci, povijest razgovora i informacije biti nepovratno uklonjeni iz naših sustava. Ova akcija se ne može poništiti.
                    </p>
                    <Button 
                      onClick={() => setShowDeleteConfirm(true)} 
                      variant="outline" 
                      className="w-full justify-start h-11 text-destructive hover:text-destructive hover:bg-destructive/5"
                    >
                      <Trash className="mr-2 h-4 w-4" /> Trajno obriši račun
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-destructive flex items-center gap-2">
                    <Trash className="w-5 h-5" />
                    Potvrda brisanja računa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm font-medium mb-2">Jeste li apsolutno sigurni?</p>
                    <p className="text-sm text-muted-foreground">
                      Ova akcija je trajna i nepovratna. Brisanjem računa:
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                      <li>Svi vaši osobni podaci bit će trajno izbrisani</li>
                      <li>Povijest svih razgovora bit će nepovratno uklonjena</li>
                      <li>Nećete moći obnoviti ovaj račun</li>
                      <li>Nećete moći registrirati novi račun s istom email adresom</li>
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      onClick={() => setShowDeleteConfirm(false)}
                      variant="outline"
                      className="flex-1"
                    >
                      Odustani
                    </Button>
                    <Button 
                      onClick={handleDeleteAccount}
                      variant="destructive"
                      className="flex-1"
                    >
                      Da, trajno obriši račun
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Kompaktna data row komponenta
function DataRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
    </div>
  );
}