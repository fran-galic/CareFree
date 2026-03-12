"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Save,
  UserCircle,
  LogOut,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Award,
  Key,
  Trash,
  Mail,
  Phone,
  Shield,
  X,
  Crop,
} from "lucide-react";
import { ProfileHeader } from "@/components/profile-header";
import { clearPersistentAvatarCache, setPersistentAvatarCache } from "@/components/persistent-avatar-image";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  getCaretakerProfile,
  uploadCV,
  deleteCV,
  uploadDiploma,
  deleteDiploma,
  uploadCertificate,
  deleteCertificate,
  uploadCaretakerImage,
  deleteCaretakerImage,
  updateCaretakerProfile,
  getHelpCategories,
  type CaretakerProfile,
  type HelpCategory,
} from "@/fetchers/users";

interface CurrentUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  age?: number | null;
  role: "student" | "caretaker";
}

interface CaretakerFormData {
  tel_num: string;
  about_me: string;
  age: string;
  grad_year: string;
  help_categories: number[];
  show_email_to_students: boolean;
  show_phone_to_students: boolean;
}

interface CropImageState {
  fileName: string;
  mimeType: string;
  url: string;
  width: number;
  height: number;
}

interface UploadSectionProps {
  icon: ReactNode;
  title: string;
  description: string;
  selectedFile: File | null;
  currentFiles: Array<{ id: number; filename: string }>;
  uploadLabel: string;
  hint: string;
  accept: string;
  uploading: boolean;
  deletingId?: number | null;
  onSelect: (file: File | null) => void;
  onUpload: () => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const CARD_CLASS =
  "border-t-[3px] border-l-[3px] border-t-primary/22 border-l-primary/22 bg-[linear-gradient(180deg,rgba(231,244,241,0.16)_0%,rgba(255,255,255,1)_30%)]";
const CROP_PREVIEW_SIZE = 280;
const CROP_OUTPUT_SIZE = 720;

function normalizePositiveNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatFileName(name: string) {
  return name.split("/").pop() || name;
}

function collectMissingProfileItems(formData: CaretakerFormData, profile: CaretakerProfile) {
  const missing: string[] = [];

  if (!formData.tel_num.trim()) {
    missing.push("telefon");
  }
  if (!formData.about_me.trim()) {
    missing.push("opis 'O meni'");
  }
  if (formData.help_categories.length === 0) {
    missing.push("barem jedna kategorija pomoći");
  }
  if (!profile.cv_file) {
    missing.push("točno jedan CV");
  }
  if (!profile.diploma_files?.length) {
    missing.push("barem jedna diploma");
  }
  if (!profile.image) {
    missing.push("profilna slika");
  }

  return missing;
}

function collectMissingFormFields(formData: CaretakerFormData) {
  const missing: string[] = [];

  if (!formData.tel_num.trim()) {
    missing.push("telefon");
  }
  if (!formData.about_me.trim()) {
    missing.push("opis 'O meni'");
  }
  if (formData.help_categories.length === 0) {
    missing.push("barem jedna kategorija pomoći");
  }

  return missing;
}

async function getCropImageState(file: File): Promise<CropImageState> {
  const url = URL.createObjectURL(file);

  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = url;
  });

  return {
    fileName: file.name,
    mimeType: file.type || "image/jpeg",
    url,
    width: dimensions.width,
    height: dimensions.height,
  };
}

async function buildCroppedImageFile(
  source: CropImageState,
  zoom: number,
  offsetXPercent: number,
  offsetYPercent: number,
) {
  const baseScale = Math.max(CROP_PREVIEW_SIZE / source.width, CROP_PREVIEW_SIZE / source.height);
  const scaledWidth = source.width * baseScale * zoom;
  const scaledHeight = source.height * baseScale * zoom;
  const maxOffsetX = Math.max(0, (scaledWidth - CROP_PREVIEW_SIZE) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - CROP_PREVIEW_SIZE) / 2);
  const previewOffsetX = maxOffsetX * offsetXPercent;
  const previewOffsetY = maxOffsetY * offsetYPercent;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = source.url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas nije dostupan za obradu slike.");
  }

  const scaleToOutput = CROP_OUTPUT_SIZE / CROP_PREVIEW_SIZE;
  const drawX = ((CROP_PREVIEW_SIZE - scaledWidth) / 2 + previewOffsetX) * scaleToOutput;
  const drawY = ((CROP_PREVIEW_SIZE - scaledHeight) / 2 + previewOffsetY) * scaleToOutput;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    drawX,
    drawY,
    scaledWidth * scaleToOutput,
    scaledHeight * scaleToOutput,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
        return;
      }
      reject(new Error("Neuspješno generiranje profilne slike."));
    }, "image/jpeg", 0.92);
  });

  const baseName = source.fileName.replace(/\.[^.]+$/, "") || "profilna";
  return new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" });
}

function UploadSection({
  icon,
  title,
  description,
  selectedFile,
  currentFiles,
  uploadLabel,
  hint,
  accept,
  uploading,
  deletingId,
  onSelect,
  onUpload,
  onDelete,
}: UploadSectionProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-primary/10 bg-white/90 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon}
            <span>{title}</span>
            {currentFiles.length > 0 && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
          {currentFiles.length}
        </Badge>
      </div>

      {currentFiles.length > 0 ? (
        <div className="space-y-1 rounded-xl border border-primary/10 bg-secondary/30 px-3 py-2">
          {currentFiles.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg py-1">
              <p className="min-w-0 break-all text-xs text-muted-foreground">{formatFileName(file.filename)}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-[#9b4636] hover:bg-[#f3dfd9] hover:text-[#863b2d]"
                disabled={deletingId === file.id}
                onClick={() => void onDelete(file.id)}
              >
                {deletingId === file.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Trenutno nema uploadanih datoteka.</p>
      )}

      <div className="flex flex-col gap-2">
        <Input
          type="file"
          accept={accept}
          onChange={(e) => onSelect(e.target.files?.[0] || null)}
          disabled={uploading}
          className="text-sm"
        />
        {selectedFile && (
          <div className="rounded-xl border border-primary/10 bg-secondary/20 px-3 py-2">
            <p className="text-xs font-medium text-foreground">Spremno za upload</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{selectedFile.name}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full whitespace-normal text-left sm:w-auto"
                onClick={() => void onUpload()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploadLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 self-end text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:self-auto sm:ml-auto"
                onClick={() => onSelect(null)}
                disabled={uploading}
                aria-label="Ukloni odabranu datoteku"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function CaretakerProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<CaretakerProfile | null>(null);
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [formData, setFormData] = useState<CaretakerFormData>({
    tel_num: "",
    about_me: "",
    age: "",
    grad_year: "",
    help_categories: [],
    show_email_to_students: false,
    show_phone_to_students: false,
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [cropImage, setCropImage] = useState<CropImageState | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [uploadingDiploma, setUploadingDiploma] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aIsOther = a.slug === "ostalo" || a.label.trim().toLowerCase() === "ostalo";
      const bIsOther = b.slug === "ostalo" || b.label.trim().toLowerCase() === "ostalo";

      if (aIsOther === bIsOther) {
        return a.label.localeCompare(b.label, "hr");
      }

      return aIsOther ? 1 : -1;
    });
  }, [categories]);

  useEffect(() => {
    return () => {
      if (cropImage?.url) {
        URL.revokeObjectURL(cropImage.url);
      }
    };
  }, [cropImage]);

  const syncProfileState = (profileData: CaretakerProfile) => {
    setProfile(profileData);
    setFormData({
      tel_num: profileData.tel_num || "",
      about_me: profileData.about_me || "",
      age: profileData.age ? String(profileData.age) : "",
      grad_year: profileData.grad_year ? String(profileData.grad_year) : "",
      help_categories: profileData.help_categories || [],
      show_email_to_students: profileData.show_email_to_students || false,
      show_phone_to_students: profileData.show_phone_to_students || false,
    });
  };

  const refreshProfileOnly = async () => {
    const profileData = await getCaretakerProfile();
    setProfile(profileData);
    return profileData;
  };

  const syncAvatarCaches = (nextImageUrl: string | null | undefined) => {
    if (!user) {
      return;
    }

    const selfKey = `avatar:self:${user.id}`;
    const keys = [
      selfKey,
      `avatar:layout:${user.id}`,
      `avatar:profile-header:caretaker:${user.email}`,
      `avatar:search:${user.id}`,
      `avatar:caretaker-public:${user.id}`,
      `avatar:messages:${user.id}`,
      `avatar:messages-new:${user.id}`,
    ];

    keys.forEach((key) => {
      if (nextImageUrl) {
        setPersistentAvatarCache(key, nextImageUrl);
      } else {
        clearPersistentAvatarCache(key);
      }
    });
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!userRes.ok) {
          if (userRes.status === 401) {
            router.push("/accounts/login");
          }
          return;
        }

        const userData = await userRes.json();
        if (userData.role === "student") {
          router.push("/carefree/profile/student");
          return;
        }

        setUser(userData);

        const [profileData, categoriesData] = await Promise.all([
          getCaretakerProfile(),
          getHelpCategories(),
        ]);

        syncProfileState(profileData);
        setCategories(categoriesData.categories || []);
      } catch (error) {
        console.error(error);
        setMessage({ type: "error", text: "Greška pri dohvaćanju podataka" });
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [router]);

  const handleCVUpload = async () => {
    if (!cvFile) {
      return;
    }

    setUploadingCV(true);
    setMessage(null);
    try {
      await uploadCV(cvFile);
      await refreshProfileOnly();
      setCvFile(null);
      setMessage({ type: "success", text: "CV je uspješno spremljen. Novi upload zamjenjuje postojeći CV." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Greška pri uploadu CV-a" });
    } finally {
      setUploadingCV(false);
    }
  };

  const handleDiplomaUpload = async () => {
    if (!diplomaFile) {
      return;
    }

    setUploadingDiploma(true);
    setMessage(null);
    try {
      await uploadDiploma(diplomaFile);
      await refreshProfileOnly();
      setDiplomaFile(null);
      setMessage({ type: "success", text: "Diploma je uspješno uploadana." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Greška pri uploadu diplome" });
    } finally {
      setUploadingDiploma(false);
    }
  };

  const handleCertificateUpload = async () => {
    if (!certificateFile) {
      return;
    }

    setUploadingCertificate(true);
    setMessage(null);
    try {
      await uploadCertificate(certificateFile);
      await refreshProfileOnly();
      setCertificateFile(null);
      setMessage({ type: "success", text: "Certifikat je uspješno uploadan." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Greška pri uploadu certifikata" });
    } finally {
      setUploadingCertificate(false);
    }
  };

  const closeCropModal = () => {
    setCropImage((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
  };

  const handleImageSelection = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const cropState = await getCropImageState(file);
      setCropImage((current) => {
        if (current?.url) {
          URL.revokeObjectURL(current.url);
        }
        return cropState;
      });
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setMessage(null);
    } catch {
      setMessage({ type: "error", text: "Odabrana datoteka nije valjana slika." });
    }
  };

  const handleImageUpload = async () => {
    if (!cropImage) {
      return;
    }

    setUploadingImage(true);
    setMessage(null);
    try {
      const croppedFile = await buildCroppedImageFile(cropImage, cropZoom, cropOffsetX, cropOffsetY);
      await uploadCaretakerImage(croppedFile);
      const nextProfile = await refreshProfileOnly();
      syncAvatarCaches(nextProfile.image);
      closeCropModal();
      setMessage({ type: "success", text: "Profilna slika je uspješno spremljena." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Greška pri uploadu slike" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteCV = async (id: number) => {
    setDeletingFileId(id);
    setMessage(null);
    try {
      await deleteCV();
      await refreshProfileOnly();
      setMessage({ type: "warning", text: "CV je uklonjen. Profil više nije potpun dok ne uploadate novi CV." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Greška pri brisanju CV-a" });
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleDeleteDiploma = async (id: number) => {
    setDeletingFileId(id);
    setMessage(null);
    try {
      await deleteDiploma(id);
      await refreshProfileOnly();
      setMessage({ type: "warning", text: "Diploma je uklonjena." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Greška pri brisanju diplome" });
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleDeleteCertificate = async (id: number) => {
    setDeletingFileId(id);
    setMessage(null);
    try {
      await deleteCertificate(id);
      await refreshProfileOnly();
      setMessage({ type: "warning", text: "Certifikat je uklonjen." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Greška pri brisanju certifikata" });
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleDeleteImage = async () => {
    setDeletingFileId(-1);
    setMessage(null);
    try {
      await deleteCaretakerImage();
      const nextProfile = await refreshProfileOnly();
      syncAvatarCaches(nextProfile.image);
      setMessage({ type: "warning", text: "Profilna slika je uklonjena. Profil više nije potpun dok ne dodate novu." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Greška pri brisanju profilne slike" });
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    const missingFormFields = collectMissingFormFields(formData);
    if (missingFormFields.length > 0) {
      setSaving(false);
      setMessage({
        type: "warning",
        text: `Za spremanje još trebate ispuniti: ${missingFormFields.join(", ")}.`,
      });
      return;
    }
    try {
      const updatedProfile = await updateCaretakerProfile({
        tel_num: formData.tel_num,
        about_me: formData.about_me,
        age: normalizePositiveNumber(formData.age),
        grad_year: normalizePositiveNumber(formData.grad_year),
        help_categories: formData.help_categories,
        show_email_to_students: formData.show_email_to_students,
        show_phone_to_students: formData.show_phone_to_students,
      });

      syncProfileState(updatedProfile);
      setUser((current) => (current ? { ...current, age: updatedProfile.age ?? null } : current));

      if (updatedProfile.is_profile_complete) {
        setMessage({
          type: "warning",
          text: "Vaš profil je sada popunjen. Sljedeći korak je potvrda administratora.",
        });
      } else if (updatedProfile.incomplete_reason) {
        setMessage({
          type: "warning",
          text: `Profil je spremljen, ali nije potpun. ${updatedProfile.incomplete_reason}`,
        });
      } else {
        setMessage({ type: "success", text: "Profil je uspješno ažuriran." });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Greška pri spremanju profila" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout/`, { method: "POST", credentials: "include" });
    router.push("/accounts/login");
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Jeste li sigurni da želite TRAJNO obrisati svoj račun? Ova akcija se ne može poništiti!")) {
      return;
    }
    if (!confirm("Posljednje upozorenje: Svi vaši podaci će biti trajno izbrisani. Nastaviti?")) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/delete/`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Greška pri brisanju računa");
      }

      alert("Račun uspješno obrisan.");
      router.push("/accounts/login");
    } catch {
      alert("Greška pri brisanju računa. Pokušajte ponovno.");
    }
  };

  const toggleCategory = (categoryId: number) => {
    setFormData((prev) => ({
      ...prev,
      help_categories: prev.help_categories.includes(categoryId)
        ? prev.help_categories.filter((id) => id !== categoryId)
        : [...prev.help_categories, categoryId],
    }));
  };

  const getStatusBadge = () => {
    if (!profile) {
      return null;
    }

    if (!profile.is_profile_complete) {
      return (
        <Badge className="gap-1 border border-[#d59f91] bg-[#f3dfd9] text-[#9b4636] hover:bg-[#f3dfd9]">
          <AlertTriangle className="h-3 w-3" />
          Nepotpun profil
        </Badge>
      );
    }

    switch (profile.approval_status) {
      case "APPROVED":
        return (
          <Badge variant="default" className="gap-1 bg-[#3b8f63] hover:bg-[#3b8f63]">
            <CheckCircle2 className="h-3 w-3" />
            Odobren
          </Badge>
        );
      case "DENIED":
        return (
          <Badge className="gap-1 border border-[#d59f91] bg-[#f3dfd9] text-[#9b4636] hover:bg-[#f3dfd9]">
            <XCircle className="h-3 w-3" />
            Odbijen
          </Badge>
        );
      case "PENDING":
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Čeka odobrenje
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const cropBaseScale = cropImage
    ? Math.max(CROP_PREVIEW_SIZE / cropImage.width, CROP_PREVIEW_SIZE / cropImage.height)
    : 1;
  const cropScaledWidth = cropImage ? cropImage.width * cropBaseScale * cropZoom : CROP_PREVIEW_SIZE;
  const cropScaledHeight = cropImage ? cropImage.height * cropBaseScale * cropZoom : CROP_PREVIEW_SIZE;
  const cropMaxOffsetX = Math.max(0, (cropScaledWidth - CROP_PREVIEW_SIZE) / 2);
  const cropMaxOffsetY = Math.max(0, (cropScaledHeight - CROP_PREVIEW_SIZE) / 2);
  const cropPreviewOffsetX = cropMaxOffsetX * cropOffsetX;
  const cropPreviewOffsetY = cropMaxOffsetY * cropOffsetY;
  const missingProfileItems = collectMissingProfileItems(formData, profile);
  return (
    <div className="container mx-auto max-w-6xl px-6 py-12" data-theme="caretaker">
      <ProfileHeader
        userId={user.id}
        firstName={user.first_name}
        lastName={user.last_name}
        email={user.email}
        role="caretaker"
        imageUrl={profile.image || null}
      />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Status verifikacije:</h2>
          {getStatusBadge()}
        </div>
      </div>

      {!profile.is_profile_complete && (
        <Alert className="mb-6 border-[#d59f91] bg-[#f3dfd9]">
          <AlertTriangle className="h-4 w-4 text-[#9b4636]" />
          <AlertDescription className="text-[#7f4336]">
            <strong>Profil još nije potpun.</strong> Za predaju su obavezni točno jedan CV, barem jedna diploma, profilna slika i osnovni podaci.
            Trenutno nedostaje: {missingProfileItems.join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      {profile.is_profile_complete && profile.approval_status === "PENDING" && (
        <Alert className="mb-6 border-[#b9d8c4] bg-[#edf8f1]">
          <Clock className="h-4 w-4 text-[#3b8f63]" />
          <AlertDescription className="text-[#2f6a4a]">
            <strong>Vaš profil je popunjen.</strong> Sada čekate potvrdu administratora prije objave profila studentima.
          </AlertDescription>
        </Alert>
      )}

      {profile.approval_status === "APPROVED" && (
        <Alert className="mb-6 border-[#b9d8c4] bg-[#edf8f1]">
          <CheckCircle2 className="h-4 w-4 text-[#3b8f63]" />
          <AlertDescription className="text-[#2f6a4a]">
            <strong>Vaš profil je odobren.</strong> Administrator je potvrdio račun i sada možete krenuti s radom.
          </AlertDescription>
        </Alert>
      )}

      <Separator className="mb-10 opacity-50" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle className="text-lg">Osnovni podaci</CardTitle>
              <CardDescription>Podaci koje uređujete za svoj javni profil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Email</Label>
                <div className="truncate font-medium">{user.email}</div>
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Dob</Label>
                <div className="font-medium">{user.age ? `${user.age} god.` : "Nije uneseno"}</div>
              </div>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Vidljivost kontakta
              </CardTitle>
              <CardDescription>Vi birate koje podatke studenti smiju vidjeti na vašem javnom profilu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-primary/10 bg-white/90 p-4">
                <input
                  type="checkbox"
                  checked={formData.show_email_to_students}
                  onChange={(e) => setFormData((prev) => ({ ...prev, show_email_to_students: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Mail className="h-4 w-4 text-primary" />
                    Prikaži email studentima
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Ako je uključeno, studenti će na vašem javnom profilu vidjeti {user.email}.
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-primary/10 bg-white/90 p-4">
                <input
                  type="checkbox"
                  checked={formData.show_phone_to_students}
                  onChange={(e) => setFormData((prev) => ({ ...prev, show_phone_to_students: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Phone className="h-4 w-4 text-primary" />
                    Prikaži broj studentima
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Ako je uključeno, studenti će na vašem javnom profilu vidjeti broj koji unesete u nastavku.
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Dokumenti
              </CardTitle>
              <CardDescription>
                Obavezno: točno jedan CV i barem jedna diploma. Certifikati su opcionalni.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UploadSection
                icon={<FileText className="h-4 w-4 text-primary" />}
                title="CV"
                description="Obavezan je točno jedan CV. Ako uploadate novi, automatski zamjenjuje postojeći."
                selectedFile={cvFile}
                currentFiles={profile.cv_file ? [profile.cv_file] : []}
                uploadLabel="Spremi CV"
                hint="PDF, JPG ili JPEG, max 10MB"
                accept=".pdf,.jpg,.jpeg"
                uploading={uploadingCV}
                deletingId={deletingFileId}
                onSelect={setCvFile}
                onUpload={handleCVUpload}
                onDelete={handleDeleteCV}
              />

              <UploadSection
                icon={<Award className="h-4 w-4 text-primary" />}
                title="Diplome"
                description="Obavezna je barem jedna diploma. Možete uploadati i više njih."
                selectedFile={diplomaFile}
                currentFiles={profile.diploma_files || []}
                uploadLabel="Dodaj diplomu"
                hint="PDF, JPG ili JPEG, max 10MB"
                accept=".pdf,.jpg,.jpeg"
                uploading={uploadingDiploma}
                deletingId={deletingFileId}
                onSelect={setDiplomaFile}
                onUpload={handleDiplomaUpload}
                onDelete={handleDeleteDiploma}
              />

              <UploadSection
                icon={<Award className="h-4 w-4 text-primary" />}
                title="Certifikati"
                description="Možete uploadati više certifikata i potvrda relevantnih za rad."
                selectedFile={certificateFile}
                currentFiles={profile.certificate_files || []}
                uploadLabel="Dodaj certifikat"
                hint="PDF, JPG ili JPEG, max 10MB"
                accept=".pdf,.jpg,.jpeg"
                uploading={uploadingCertificate}
                deletingId={deletingFileId}
                onSelect={setCertificateFile}
                onUpload={handleCertificateUpload}
                onDelete={handleDeleteCertificate}
              />

              <div className="space-y-3 rounded-2xl border border-primary/10 bg-white/90 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Crop className="h-4 w-4 text-primary" />
                    Profilna slika
                    {profile.image && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Odaberite sliku, zatim je namjestite u popup prozoru prije konačnog spremanja.
                  </p>
                </div>
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) => void handleImageSelection(e.target.files?.[0] || null)}
                  disabled={uploadingImage}
                  className="text-sm"
                />
                {profile.image && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start text-[#9b4636] hover:bg-[#f3dfd9] hover:text-[#863b2d]"
                    onClick={() => void handleDeleteImage()}
                    disabled={deletingFileId === -1}
                  >
                    {deletingFileId === -1 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
                    Ukloni trenutnu profilnu sliku
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">JPG, JPEG, PNG ili WEBP, max 10MB</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button onClick={handleSaveProfile} disabled={saving} className="h-12 w-full">
              {saving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Spremi profil
            </Button>
            <Button onClick={() => router.push("/carefree/profile/change-password")} variant="outline" className="h-12 w-full">
              <Key className="mr-2 h-4 w-4" />
              Promijeni lozinku
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="h-12 w-full text-[#9b4636] hover:bg-[#f3dfd9] hover:text-[#863b2d]"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Odjava
            </Button>
            <Separator className="my-2" />
            <Button onClick={handleDeleteAccount} className="h-12 w-full bg-[#c6523d] text-white hover:bg-[#ae4735]">
              <Trash className="mr-2 h-4 w-4" />
              Obriši račun
            </Button>
          </div>

          {message && (
            <div
              className={`rounded-lg p-3 text-center text-sm ${
                message.type === "success"
                  ? "border border-primary/15 bg-secondary/70 text-primary"
                  : message.type === "warning"
                    ? "border border-[#ead7ad] bg-[#fff8e7] text-[#8a6318]"
                  : "border border-[#d59f91] bg-[#f3dfd9] text-[#9b4636]"
              }`}
            >
              <p className="mx-auto max-w-md leading-6">{message.text}</p>
            </div>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-primary" />
                O meni
              </CardTitle>
              <CardDescription>Osnovni podaci koji opisuju vaš profesionalni profil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="age">Dob</Label>
                  <Input
                    id="age"
                    type="number"
                    min={0}
                    max={100}
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="npr. 34"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grad_year">Godina diplomiranja</Label>
                  <Input
                    id="grad_year"
                    type="number"
                    value={formData.grad_year}
                    onChange={(e) => setFormData({ ...formData, grad_year: e.target.value })}
                    placeholder="npr. 2020"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tel_num">Telefon *</Label>
                  <Input
                    id="tel_num"
                    value={formData.tel_num}
                    onChange={(e) => setFormData({ ...formData, tel_num: e.target.value })}
                    placeholder="+385 ..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="about_me">O meni *</Label>
                <Textarea
                  id="about_me"
                  rows={6}
                  value={formData.about_me}
                  onChange={(e) => setFormData({ ...formData, about_me: e.target.value })}
                  className="resize-none"
                  placeholder="Opišite svoje radno iskustvo, pristup radu i područja u kojima najviše pomažete studentima..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader>
              <CardTitle>Kategorije pomoći *</CardTitle>
              <CardDescription>Odaberite područja u kojima nudite podršku studentima.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sortedCategories.map((category) => (
                  <div key={category.id} className="space-y-2 rounded-2xl border border-primary/10 bg-white/90 p-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`cat-${category.id}`}
                        checked={formData.help_categories.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor={`cat-${category.id}`} className="cursor-pointer font-semibold">
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
                              className="h-4 w-4 rounded border-gray-300"
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

      {cropImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <div className="w-full max-w-3xl rounded-[28px] border border-white/15 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Namjesti profilnu sliku</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Podesite kadar, zoom i poziciju prije konačnog spremanja.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeCropModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
              <div className="flex flex-col items-center gap-4">
                <div className="relative overflow-hidden rounded-[32px] border border-primary/15 bg-secondary/30" style={{ width: CROP_PREVIEW_SIZE, height: CROP_PREVIEW_SIZE }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cropImage.url}
                    alt="Crop preview"
                    className="absolute max-w-none"
                    style={{
                      width: cropScaledWidth,
                      height: cropScaledHeight,
                      left: `calc(50% - ${cropScaledWidth / 2}px + ${cropPreviewOffsetX}px)`,
                      top: `calc(50% - ${cropScaledHeight / 2}px + ${cropPreviewOffsetY}px)`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{cropImage.fileName}</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Zoom</span>
                    <span className="text-muted-foreground">{cropZoom.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="2.6"
                    step="0.01"
                    value={cropZoom}
                    onChange={(e) => setCropZoom(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Pomak lijevo/desno</span>
                    <span className="text-muted-foreground">{Math.round(cropOffsetX * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={cropOffsetX}
                    onChange={(e) => setCropOffsetX(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Pomak gore/dolje</span>
                    <span className="text-muted-foreground">{Math.round(cropOffsetY * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={cropOffsetY}
                    onChange={(e) => setCropOffsetY(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="rounded-2xl border border-primary/10 bg-secondary/25 px-4 py-3 text-sm text-muted-foreground">
                  Koristimo kvadratni kadar kako bi profilna bila uredna i konzistentna na svim ekranima.
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closeCropModal}>
                    Odustani
                  </Button>
                  <Button type="button" onClick={() => void handleImageUpload()} disabled={uploadingImage}>
                    {uploadingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crop className="mr-2 h-4 w-4" />}
                    Spremi profilnu
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
