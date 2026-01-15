"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import Image from "next/image";
import { getJournalEntries, createJournalEntry, deleteJournalEntry, updateJournalEntry } from "@/fetchers/journal";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, PlusCircle, BookOpen, Edit2, NotebookPen, PencilOff } from "lucide-react"; // Dodana Edit2 ikona
import { Separator } from "@/components/ui/separator";

export default function JournalPage() {
  // Dohvaćanje podataka pomoću SWR-a (automatski cache i revalidacija)
  const { data: entries, error, isLoading } = useSWR("/api/journal/", getJournalEntries);
  
  // Stanje za formu novog unosa
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null); // ID zapisa koji se uređuje
  const [newEntry, setNewEntry] = useState({ title: "", content: "", mood: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Funkcija za slanje novog zapisa
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        // Ažuriranje postojećeg zapisa
        await updateJournalEntry(editingId, newEntry);
        setEditingId(null);
      } else {
        // Kreiranje novog zapisa
        await createJournalEntry(newEntry);
      }
      setNewEntry({ title: "", content: "", mood: "" }); // Reset forme
      setIsCreating(false); // Zatvori formu
      mutate("/api/journal/"); // Osvježi listu odmah
    } catch (err) {
      console.error("Greška pri spremanju:", err);
      alert("Nismo uspjeli spremiti zapis. Provjerite vezu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Funkcija za brisanje
  const handleDelete = async (id: number) => {
    if (!confirm("Jeste li sigurni da želite obrisati ovaj zapis?")) return;
    try {
      await deleteJournalEntry(id);
      mutate("/api/journal/"); // Osvježi listu
    } catch (err) {
      console.error("Greška pri brisanju:", err);
    }
  };

  // Funkcija za pokretanje uređivanja
  const handleEdit = (entry: any) => {
    setNewEntry({
      title: entry.title,
      content: entry.content,
      mood: entry.mood || "",
    });
    setEditingId(entry.id);
    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Funkcija za otkazivanje uređivanja
  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setNewEntry({ title: "", content: "", mood: "" });
  };

  // Formatiranje datuma
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("hr-HR", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl px-4 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Moj Dnevnik
          </h1>
          <p className="text-muted-foreground mt-1">
            Privatno mjesto za tvoje misli i osjećaje. Enkriptirano i sigurno.
          </p>
        </div>
        <div className="flex justify-between gap-2">
          <Button onClick={() => setIsCreating(false)} 
          className={`gap-2 ${
                !isCreating
                  ? "bg-primary text-primary-foreground shadow-md font-bold"
                  : "text-muted-foreground bg-background border border-border hover:bg-primary/10 hover:text-primary hover:border-primary"
                }`}
          >
            {"Pregled dnevnika"}
            {<BookOpen className="h-4 w-4" />}
          </Button>
          <Button onClick={() => setIsCreating(!isCreating)}
          className={`gap-2 ${
                isCreating
                  ? "bg-primary text-primary-foreground shadow-md font-bold"
                  : "text-muted-foreground bg-background border border-border hover:bg-primary/10 hover:text-primary hover:border-primary" 
                }`}
          >
            {isCreating ? "Zatvori unos" : "Novi zapis"}
            {!isCreating && <NotebookPen className="h-4 w-4" />}
            {isCreating && <PencilOff className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* FORMA ZA NOVI ZAPIS (Prikazuje se samo kad kliknemo gumb) */}
      {isCreating && (
        <div className="mb-10 animate-in slide-in-from-top-4 duration-300">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle>{editingId ? "Uredi zapis" : "Novi unos"}</CardTitle>
              <CardDescription>{editingId ? "Ažuriraj svoj zapis" : "Kako se osjećaš danas?"}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Naslov</Label>
                        <Input 
                            id="title" 
                            placeholder="Sažetak dana..." 
                            value={newEntry.title}
                            onChange={(e) => setNewEntry({...newEntry, title: e.target.value})}
                            required
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <Label>Kako se osjećaš?</Label>
                    <div className="flex gap-3 pt-3 pb-2 justify-start flex-wrap ">
                        {[
                            { id: "vrlo-sretno", image: "/images/emot1.png" },
                            { id: "sretno", image: "/images/emot2.png" },
                            { id: "neutralno", image: "/images/emot3.png" },
                            { id: "tuzno", image: "/images/emot4.png" },
                            { id: "vrlo-tuzno", image: "/images/emot5.png" },
                        ].map((emotion) => {
                            const [emojiPart, wordPart] = newEntry.mood?.split(":") || ["", ""];
                            const isSelected = emojiPart === emotion.id;
                            
                            return (
                                <button
                                    type="button"
                                    key={emotion.id}
                                    onClick={() => setNewEntry({...newEntry, mood: `${emotion.id}:${wordPart || ""}`})}
                                    className={`relative w-20 h-20 rounded-full border-2 transition-all overflow-hidden flex items-center justify-center ${
                                        isSelected
                                            ? "border-primary bg-primary/10 scale-105" 
                                            : "border-muted-foreground/30 hover:border-primary/50"
                                    }`}
                                >
                                    <Image
                                        src={emotion.image}
                                        alt={emotion.id}
                                        fill
                                        className="object-cover"
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-3">
                    <Label>Ili drugačije rečeno...</Label>
                    <div className="flex gap-3 pt-3 pb-2 justify-start flex-wrap">
                        {[
                            { id: "uzbuđeno", label: "Uzbuđeno" },
                            { id: "sretno", label: "Sretno" },
                            { id: "motivirano", label: "Motivirano" },
                            { id: "smireno", label: "Smireno" },
                            { id: "razočarano", label: "Razočarano" },
                            { id: "usamljeno", label: "Usamljeno" },
                            { id: "anksiozno", label: "Anksiozno" },
                            { id: "tužno", label: "Tužno" },
                            { id: "ljuto", label: "Ljuto" },
                            { id: "nervozno", label: "Nervozno" },
                            { id: "umorno", label: "Umorno" },
                            { id: "iscrpljeno", label: "Iscrpljeno" },
                        ].map((emotion) => {
                            const [emojiPart, wordPart] = newEntry.mood?.split(":") || ["", ""];
                            const wordEmotions = wordPart?.split("+").map(e => e.trim()).filter(e => e) || [];
                            const isSelected = wordEmotions.includes(emotion.id);
                            const isMaxReached = wordEmotions.length >= 3 && !isSelected;
                            
                            return (
                                <button
                                    type="button"
                                    key={emotion.id}
                                    onClick={() => {
                                        if (isSelected) {
                                            // Deselect
                                            const updated = wordEmotions.filter(e => e !== emotion.id).join("+");
                                            setNewEntry({...newEntry, mood: `${emojiPart}:${updated}`});
                                        } else if (!isMaxReached) {
                                            // Select (if not at max)
                                            const updated = wordEmotions.length > 0 
                                                ? `${wordPart}+${emotion.id}` 
                                                : emotion.id;
                                            setNewEntry({...newEntry, mood: `${emojiPart}:${updated}`});
                                        }
                                    }}
                                    disabled={isMaxReached}
                                    className={`px-4 py-2 rounded-full border-2 transition-all text-sm font-medium ${
                                        isSelected 
                                            ? "border-primary text-primary font-semibold bg-primary/10" 
                                            : isMaxReached
                                            ? "border-muted-foreground/20 opacity-50 cursor-not-allowed"
                                            : "text-muted-foreground border-muted-foreground/30 hover:border-primary/50 hover:text-primary"
                                    }`}
                                >
                                    {emotion.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="content">Sadržaj</Label>
                    <Textarea 
                        id="content" 
                        placeholder="Dragi dnevniče..." 
                        className="min-h-[150px]"
                        value={newEntry.content}
                        onChange={(e) => setNewEntry({...newEntry, content: e.target.value})}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={handleCancel}>Odustani</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Spremanje..." : editingId ? "Ažuriraj" : "Spremi u dnevnik"}
                    </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* LISTA ZAPISA */}
      {!isCreating && (
        <>
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Učitavanje dnevnika...</div>
          ) : error ? (
            <div className="text-center py-10 text-red-500">Došlo je do greške pri učitavanju. Provjerite jeste li prijavljeni.</div>
          ) : entries?.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
                <p className="text-lg">Još nemaš zapisa.</p>
                <p className="text-sm">Klikni "Novi zapis" i zapiši svoju prvu misao.</p>
            </div>
          ) : (
            <div className="grid gap-6">
                {entries?.map((entry) => (
                <Card key={entry.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-xl">{entry.title || "Bez naslova"}</CardTitle>
                                <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
                                    <span>{formatDate(entry.created_at)}</span>
                                    {entry.mood && (
                                        (() => {
                                            const [emojiPart, wordPart] = entry.mood.split(":");
                                            
                                            return (
                                                <>
                                                    {wordPart && wordPart.split("+").map((mood, idx) => (
                                                        <span key={idx} className="bg-secondary px-2 py-0.5 rounded-full text-xs font-medium capitalize">
                                                            {mood.trim()}
                                                        </span>
                                                    ))}
                                                </>
                                            );
                                        })()
                                    )}
                                </CardDescription>
                            </div>
                            <div className="flex gap-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-muted-foreground hover:text-primary"
                                    onClick={() => handleEdit(entry)}
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-muted-foreground hover:text-red-500"
                                    onClick={() => handleDelete(entry.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                            {entry.content}
                        </p>
                    </CardContent>
                </Card>
            ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}