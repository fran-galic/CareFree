"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { getJournalEntries, createJournalEntry, deleteJournalEntry } from "@/fetchers/journal";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, PlusCircle, BookOpen } from "lucide-react"; // Ikone za ljepši izgled
import { Separator } from "@/components/ui/separator";

export default function JournalPage() {
  // Dohvaćanje podataka pomoću SWR-a (automatski cache i revalidacija)
  const { data: entries, error, isLoading } = useSWR("/api/journal/", getJournalEntries);
  
  // Stanje za formu novog unosa
  const [isCreating, setIsCreating] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: "", content: "", mood: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Funkcija za slanje novog zapisa
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createJournalEntry(newEntry);
      setNewEntry({ title: "", content: "", mood: "" }); // Reset forme
      setIsCreating(false); // Zatvori formu
      mutate("/api/journal/"); // Osvježi listu odmah
    } catch (err) {
      console.error("Greška pri kreiranju:", err);
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
        <Button onClick={() => setIsCreating(!isCreating)} className="gap-2">
          {isCreating ? "Zatvori unos" : "Novi zapis"}
          {!isCreating && <PlusCircle className="h-4 w-4" />}
        </Button>
      </div>

      {/* FORMA ZA NOVI ZAPIS (Prikazuje se samo kad kliknemo gumb) */}
      {isCreating && (
        <div className="mb-10 animate-in slide-in-from-top-4 duration-300">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle>Novi unos</CardTitle>
              <CardDescription>Kako se osjećaš danas?</CardDescription>
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
                    <div className="space-y-2">
                        <Label htmlFor="mood">Raspoloženje</Label>
                        <Select 
                            onValueChange={(val) => setNewEntry({...newEntry, mood: val})}
                            value={newEntry.mood}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Odaberi..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sretno">😊 Sretno</SelectItem>
                                <SelectItem value="smireno">😌 Smireno</SelectItem>
                                <SelectItem value="anksiozno">😰 Anksiozno</SelectItem>
                                <SelectItem value="tuzno">😢 Tužno</SelectItem>
                                <SelectItem value="ljuto">😠 Ljuto</SelectItem>
                                <SelectItem value="umorno">😴 Umorno</SelectItem>
                            </SelectContent>
                        </Select>
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
                        required
                    />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Odustani</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Spremanje..." : "Spremi u dnevnik"}
                    </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* LISTA ZAPISA */}
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
                                <CardDescription className="mt-1 flex items-center gap-2">
                                    <span>{formatDate(entry.created_at)}</span>
                                    {entry.mood && (
                                        <span className="bg-secondary px-2 py-0.5 rounded-full text-xs font-medium capitalize">
                                            {entry.mood}
                                        </span>
                                    )}
                                </CardDescription>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-muted-foreground hover:text-red-500"
                                onClick={() => handleDelete(entry.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
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
    </div>
  );
}