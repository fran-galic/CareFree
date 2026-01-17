"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, UserCircle, LogOut, Upload, CheckCircle2, XCircle, Clock, AlertTriangle, FileText, Award, Image as ImageIcon, Key, Trash } from "lucide-react";
import { ProfileHeader } from "@/components/profile-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  getCaretakerProfile, 
  uploadCV, 
  uploadDiploma, 
  uploadCaretakerImage, 
  updateCaretakerProfile,
  getHelpCategories,
  type CaretakerProfile,
  type HelpCategory
} from "@/fetchers/users";

export default function CaretakerProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<CaretakerProfile | null>(null);
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [formData, setFormData] = useState<any>({
    tel_num: '',
    about_me: '',
    grad_year: null,
    help_categories: [],
  });
  
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [diplomaFiles, setDiplomaFiles] = useState<File[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [uploadingDiploma, setUploadingDiploma] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  
  useEffect(() => {
    async function fetchData() {
      try {
        // Dohvat user podataka
        const userRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!userRes.ok) {
          if (userRes.status === 401) router.push("/accounts/login");
          return;
        }

        const userData = await userRes.json();
        
        if (userData.role === "student") {
          router.push("/carefree/profile/student");
          return;
        }

        setUser(userData);

        // Dohvat caretaker profila
        const profileData = await getCaretakerProfile();
        setProfile(profileData);
        setFormData({
          tel_num: profileData.tel_num || '',
          about_me: profileData.about_me || '',
          grad_year: profileData.grad_year || null,
          help_categories: profileData.help_categories || [],
        });

        // Dohvat kategorija
        const categoriesData = await getHelpCategories();
        setCategories(categoriesData.categories || []);

      } catch (error) {
        console.error(error);
        setMessage({ type: "error", text: "Greška pri dohvaćanju podataka" });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  
  const handleCVUpload = async () => {
    if (!cvFile) return;
    setUploadingCV(true);
    setMessage(null);
    try {
      await uploadCV(cvFile);
      setMessage({ type: "success", text: "CV uspješno uploadan!" });
      // Refresh profil
      const profileData = await getCaretakerProfile();
      setProfile(profileData);
      setCvFile(null);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Greška pri uploadu CV-a" });
    } finally {
      setUploadingCV(false);
    }
  };

  const handleDiplomaUpload = async (file: File) => {
    setUploadingDiploma(true);
    setMessage(null);
    try {
      await uploadDiploma(file);
      setMessage({ type: "success", text: "Diploma uspješno uploadana!" });
      // Refresh profil
      const profileData = await getCaretakerProfile();
      setProfile(profileData);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Greška pri uploadu diplome" });
    } finally {
      setUploadingDiploma(false);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;
    setUploadingImage(true);
    setMessage(null);
    try {
      await uploadCaretakerImage(imageFile);
      setMessage({ type: "success", text: "Slika uspješno uploadana!" });
      // Refresh profil
      const profileData = await getCaretakerProfile();
      setProfile(profileData);
      setImageFile(null);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Greška pri uploadu slike" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updateData = {
        tel_num: formData.tel_num,
        about_me: formData.about_me,
        grad_year: formData.grad_year ? parseInt(formData.grad_year) : null,
        help_categories: formData.help_categories,
      };
      
      const updatedProfile = await updateCaretakerProfile(updateData);
      setProfile(updatedProfile);
      
      if (updatedProfile.is_profile_complete) {
        setMessage({ type: "success", text: "Profil uspješno spremljen i potpun! Čeka se odobrenje administratora." });
      } else if (updatedProfile.incomplete_reason) {
        setMessage({ type: "error", text: `Profil spremljen, ali nije potpun. ${updatedProfile.incomplete_reason}` });
      } else {
        setMessage({ type: "success", text: "Profil uspješno ažuriran!" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Greška pri spremanju profila" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout/`, { method: "POST", credentials: "include" });
    router.push("/accounts/login");
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Jeste li sigurni da želite TRAJNO obrisati svoj račun? Ova akcija se ne može poništiti!")) return;
    if (!confirm("Posljednje upozorenje: Svi vaši podaci će biti trajno izbrisani. Nastaviti?")) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/delete/`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        alert("Račun uspješno obrisan.");
        router.push("/accounts/login");
      } else {
        throw new Error("Greška pri brisanju računa");
      }
    } catch (error) {
      alert("Greška pri brisanju računa. Pokušajte ponovno.");
    }
  };

  const toggleCategory = (categoryId: number) => {
    setFormData((prev: any) => ({
      ...prev,
      help_categories: prev.help_categories.includes(categoryId)
        ? prev.help_categories.filter((id: number) => id !== categoryId)
        : [...prev.help_categories, categoryId]
    }));
  };

  const getStatusBadge = () => {
    if (!profile) return null;
    
    if (!profile.is_profile_complete) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Nepotpun profil</Badge>;
    }
    
    switch (profile.approval_status) {
      case 'APPROVED':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" /> Odobren</Badge>;
      case 'DENIED':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Odbijen</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Čeka odobrenje</Badge>;
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user || !profile) return null;

  return (
    <div className="container mx-auto py-12 max-w-6xl px-6" data-theme="caretaker">
      <ProfileHeader 
        firstName={user.first_name} 
        lastName={user.last_name} 
        email={user.email} 
        role="caretaker"
      />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Status verifikacije:</h2>
          {getStatusBadge()}
        </div>
      </div>

      {!profile.is_profile_complete && (
        <Alert className="mb-6 border-orange-500 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Vaš profil nije potpun!</strong> Molimo uploadajte sve potrebne dokumente (CV, diploma, profilna slika) i popunite sve podatke kako bi vaš profil bio poslan na odobrenje.
          </AlertDescription>
        </Alert>
      )}

      <Separator className="mb-10 opacity-50" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LIJEVI STUPAC - Postavke i Dokumenti */}
        <div className="space-y-6">
          {/* Osnovni podaci */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Osnovni podaci</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><Label className="text-xs text-muted-foreground uppercase">Email</Label><div className="font-medium truncate">{user.email}</div></div>
              <div><Label className="text-xs text-muted-foreground uppercase">Dob</Label><div className="font-medium">{user.age} god.</div></div>
            </CardContent>
          </Card>

          {/* Upload dokumenta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Dokumenti</CardTitle>
              <CardDescription>Uploadajte potrebne dokumente za verifikaciju</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* CV Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="w-4 h-4" /> CV {profile.cv_filename && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                </Label>
                {profile.cv_filename && (
                  <p className="text-xs text-muted-foreground">Trenutni: {profile.cv_filename}</p>
                )}
                <div className="flex gap-2">
                  <Input 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    className="text-sm"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleCVUpload} 
                    disabled={!cvFile || uploadingCV}
                  >
                    {uploadingCV ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">PDF, JPG ili JPEG, max 10MB</p>
              </div>

              {/* Diploma Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Award className="w-4 h-4" /> Diploma {profile.diploma_filenames && profile.diploma_filenames.length > 0 && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                </Label>
                {profile.diploma_filenames && profile.diploma_filenames.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    {profile.diploma_filenames.map((name, idx) => (
                      <p key={idx}>• {name}</p>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDiplomaUpload(file);
                    }}
                    disabled={uploadingDiploma}
                    className="text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">PDF, JPG ili JPEG, max 10MB</p>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Profilna slika {profile.image && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                </Label>
                <div className="flex gap-2">
                  <Input 
                    type="file" 
                    accept=".jpg,.jpeg"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="text-sm"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleImageUpload} 
                    disabled={!imageFile || uploadingImage}
                  >
                    {uploadingImage ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Samo JPG ili JPEG, max 10MB</p>
              </div>

            </CardContent>
          </Card>

          {/* Akcije */}
          <div className="space-y-3">
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full h-12">
              {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />} Spremi profil
            </Button>
            <Button onClick={() => router.push("/carefree/profile/change-password")} variant="outline" className="w-full h-12">
              <Key className="mr-2 h-4 w-4" /> Promijeni lozinku
            </Button>
            <Button onClick={handleLogout} variant="outline" className="w-full h-12 text-destructive hover:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" /> Odjava
            </Button>
            <Separator className="my-2" />
            <Button onClick={handleDeleteAccount} variant="destructive" className="w-full h-12">
              <Trash className="mr-2 h-4 w-4" /> Obriši račun
            </Button>
          </div>

          {message && (
            <div className={`p-3 rounded text-sm text-center ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message.text}
            </div>
          )}
        </div>

        {/* DESNI STUPAC - Profil podaci */}
        <div className="lg:col-span-2 space-y-6">
          {/* Osnovni podaci */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-primary" /> O meni
              </CardTitle>
              <CardDescription>Osnovni podaci o vašem profilu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="tel_num">Telefon *</Label>
                  <Input 
                    id="tel_num"
                    value={formData.tel_num || ""} 
                    onChange={e => setFormData({...formData, tel_num: e.target.value})} 
                    placeholder="+385 ..." 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grad_year">Godina diplomiranja</Label>
                  <Input 
                    id="grad_year"
                    type="number" 
                    value={formData.grad_year || ""} 
                    onChange={e => setFormData({...formData, grad_year: e.target.value})} 
                    placeholder="npr. 2020" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="about_me">O meni *</Label>
                <Textarea 
                  id="about_me"
                  rows={5} 
                  value={formData.about_me || ""} 
                  onChange={e => setFormData({...formData, about_me: e.target.value})} 
                  className="resize-none" 
                  placeholder="Opišite svoje radno iskustvo i pristup radu..." 
                />
              </div>
            </CardContent>
          </Card>

          {/* Kategorije pomoći */}
          <Card>
            <CardHeader>
              <CardTitle>Kategorije pomoći *</CardTitle>
              <CardDescription>Odaberite područja u kojima nudite pomoć</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categories.map((category) => (
                  <div key={category.id} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`cat-${category.id}`}
                        checked={formData.help_categories.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <Label htmlFor={`cat-${category.id}`} className="font-semibold cursor-pointer">
                        {category.label}
                      </Label>
                    </div>
                    {category.subcategories && category.subcategories.length > 0 && (
                      <div className="ml-6 space-y-2">
                        {category.subcategories.map((sub) => (
                          <div key={sub.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`cat-${sub.id}`}
                              checked={formData.help_categories.includes(sub.id)}
                              onChange={() => toggleCategory(sub.id)}
                              className="w-4 h-4 rounded border-gray-300"
                            />
                            <Label htmlFor={`cat-${sub.id}`} className="cursor-pointer text-sm">
                              {sub.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
