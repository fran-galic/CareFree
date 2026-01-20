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
  Settings
} from "lucide-react";

export default function StudentProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="info" className="gap-2">
              <User className="w-4 h-4" />
              Osobni podaci
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-2">
              <Settings className="w-4 h-4" />
              Akcije
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Osnovne informacije - kompaktno */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Osnovne informacije</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <DataRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
                  <Separator />
                  <DataRow icon={<Calendar className="w-4 h-4" />} label="Dob" value={user.age ? `${user.age} god.` : "—"} />
                  <Separator />
                  <DataRow icon={<User className="w-4 h-4" />} label="Spol" value={user.sex === 'M' ? 'Muški' : user.sex === 'F' ? 'Ženski' : user.sex === 'O' ? 'Ne želim reći' : '—'} />
                </CardContent>
              </Card>

              {/* Akademske informacije */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Akademske informacije</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <DataRow 
                    icon={<BookOpen className="w-4 h-4" />} 
                    label="Fakultet" 
                    value={student?.studying_at || "—"} 
                  />
                  <Separator />
                  <DataRow 
                    icon={<GraduationCap className="w-4 h-4" />} 
                    label="Godina studija" 
                    value={student?.year_of_study ? `${student.year_of_study}. godina` : "—"} 
                  />
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