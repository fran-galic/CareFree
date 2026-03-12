"use client";

import Link from 'next/link';
import { useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import SearchBar from "@/components/search-bar";
import { searchCaretakers, getHelpCategories } from "@/fetchers/users";
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filter, Briefcase, Clock, ChevronRight, Stethoscope, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SearchPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const q = searchParams.get("q") ?? "";
  const categoriesParam = searchParams.getAll("categories");
  const currentPage = parseInt(searchParams.get("page") ?? "1");

  const { data: categoriesData } = useSWR('help-categories', getHelpCategories);
  
  const { data: caretakersData, isLoading } = useSWR(
    [`search`, q, categoriesParam, currentPage], 
    ([, query, cats, page]) => searchCaretakers(query, cats, page)
  );

  const caretakerList = caretakersData?.results ?? [];
  const totalCount = caretakersData?.count ?? 0;
  const pageSize = 20; // Backend vraća 20 po stranici
  const totalPages = Math.ceil(totalCount / pageSize);
  const sortedCategories = useMemo(() => {
    const categories = categoriesData?.categories ?? [];
    return [...categories].sort((a, b) => {
      const aIsOther = a.slug === "ostalo" || a.label.trim().toLowerCase() === "ostalo";
      const bIsOther = b.slug === "ostalo" || b.label.trim().toLowerCase() === "ostalo";

      if (aIsOther === bIsOther) {
        return a.label.localeCompare(b.label, "hr");
      }

      return aIsOther ? 1 : -1;
    });
  }, [categoriesData]);

  const handleCategoryChange = (slug: string, isChecked: boolean) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (isChecked) {
        current.append("categories", slug);
    } else {
        current.delete("categories");
        const newCats = categoriesParam.filter(c => c !== slug);
        newCats.forEach(c => current.append("categories", c));
    }
    // Reset na prvu stranicu kad se mijenjaju filtri
    current.delete("page");
    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${pathname}${query}`);
  };

  const handlePageChange = (newPage: number) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (newPage > 1) {
      current.set("page", newPage.toString());
    } else {
      current.delete("page");
    }
    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${pathname}${query}`);
    // Scroll na vrh stranice
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mx-auto py-10 min-h-screen pr-4 max-w-7xl">
      
      {/* HEADER SEKCIJA */}
      <div className="mb-12 text-center space-y-6">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-primary">
            Pronađi svog CareTakera
        </h1>
        <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
            Pretražite našu bazu licenciranih psihologa i pronađite osobu uz koju se osjećate sigurno, viđeno i podržano.
        </p>
        <div className="max-w-2xl mx-auto pt-4">
             <SearchBar initial={q} />
        </div>
      </div>

      <Card className="mb-8 overflow-hidden border-primary/15 bg-gradient-to-r from-primary/8 via-background to-amber-50/70 shadow-sm">
        <div className="grid gap-6 px-6 py-6 md:grid-cols-[1.4fr_0.9fr] md:px-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Julija može pomoći
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Niste sigurni što vas točno muči?
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Ako još ne znate koji bi psiholog bio najbolji izbor, razgovarajte s Julijom. Kroz siguran i strukturiran razgovor pomoći će vam jasnije razumjeti situaciju i usmjeriti vas prema osobi koja vam najbolje odgovara.
            </p>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Krenite od razgovora s AI asistenticom
              </p>
              <p className="text-sm text-muted-foreground">
                Julija vam može pomoći prepoznati temu razgovora i napraviti prvi korak bez pritiska.
              </p>
            </div>
            <Button asChild className="w-full md:w-auto">
              <Link href="/carefree/messages">Razgovaraj s Julijom</Link>
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* SIDEBAR FILTERI - STICKY POZICIJA */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28 h-fit">
            <div className="bg-card border rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4 text-primary font-semibold">
                    <Filter className="w-4 h-4" /> 
                    <span className="text-base">Filtriraj po problemu</span>
                </div>
                <Separator className="mb-4" />
                <div className="mb-5 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                        Znate što vas muči?
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Pretražite našu bazu licenciranih psihologa i suzite izbor prema temi o kojoj želite razgovarati.
                    </p>
                </div>
                
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                    {sortedCategories.map((cat) => (
                        <div key={cat.id} className="rounded-xl border border-border/70 bg-background/70 p-4 shadow-sm">
                            <div className="flex items-center space-x-3 group">
                                <Checkbox 
                                    id={cat.slug} 
                                    checked={categoriesParam.includes(cat.slug)}
                                    onCheckedChange={(checked) => handleCategoryChange(cat.slug, checked as boolean)}
                                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-colors"
                                />
                                <Label htmlFor={cat.slug} className="text-sm cursor-pointer font-semibold text-foreground group-hover:text-primary transition-colors">
                                    {cat.label}
                                </Label>
                            </div>
                            {cat.subcategories.length > 0 ? (
                                <div className="mt-3 space-y-2.5 border-l-2 border-muted pl-4">
                                    {cat.subcategories.map(sub => (
                                        <div key={sub.id} className="flex items-start space-x-3 group">
                                            <Checkbox 
                                                id={sub.slug}
                                                checked={categoriesParam.includes(sub.slug)}
                                                onCheckedChange={(checked) => handleCategoryChange(sub.slug, checked as boolean)}
                                            />
                                            <Label htmlFor={sub.slug} className="text-sm text-muted-foreground cursor-pointer leading-snug group-hover:text-foreground transition-colors">
                                                {sub.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* LISTA REZULTATA */}
        <div className="lg:col-span-7">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-muted-foreground">Tražimo CareTakera koji najbolje odgovara vašim potrebama...</p>
                </div>
            ) : caretakerList.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/30">
                    <Stethoscope className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <h3 className="text-xl font-semibold text-foreground">Nema rezultata</h3>
                    <p className="text-muted-foreground mt-2">Pokušajte promijeniti filtere ili ključnu riječ.</p>
                </div>
            ) : (
                <div className="grid gap-5">
                    {caretakerList.map((caretaker) => (
                        <Link key={caretaker.user_id} href={`/carefree/caretaker/${caretaker.user_id}`}>
                            <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50 border-muted">
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="text-primary w-6 h-6" />
                                </div>
                                
                                <div className="flex flex-col sm:flex-row gap-6 p-6">
                                    {/* AVATAR SEKCIJA */}
                                    <div className="flex-shrink-0">
                                        <Avatar className="w-24 h-24 border-4 border-background shadow-sm group-hover:scale-105 transition-transform duration-300">
                                            {caretaker.user_image_url ? (
                                                <AvatarImage src={caretaker.user_image_url} className="object-cover" />
                                            ) : null}
                                            <AvatarFallback className="text-2xl bg-primary/5 text-primary font-bold">
                                                {caretaker.first_name?.charAt(0)}
                                                {caretaker.last_name?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    
                                    {/* INFO SEKCIJA */}
                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                                                {caretaker.first_name} {caretaker.last_name}
                                            </h3>
                                            
                                            <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1.5">
                                                    <Briefcase className="w-4 h-4 text-primary/70" />
                                                    <span className="font-medium">{caretaker.academic_title}</span>
                                                </div>
                                                {caretaker.working_since && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-4 h-4 text-primary/70" />
                                                        <span>Iskustvo od {caretaker.working_since}.</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <p className="text-sm text-foreground/70 leading-relaxed line-clamp-2">
                                            {caretaker.about_me || "Nema opisa."}
                                        </p>

                                        <Separator className="my-2 opacity-50" />

                                        {/* KATEGORIJE - CHIPS */}
                                        <div className="flex flex-wrap gap-2">
                                            {caretaker.help_categories.slice(0, 5).map((cat) => (
                                                <span 
                                                    key={cat} 
                                                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-secondary-foreground/10 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-colors"
                                                >
                                                    {cat}
                                                </span>
                                            ))}
                                            {caretaker.help_categories.length > 5 && (
                                                <span className="text-xs text-muted-foreground self-center px-2">
                                                    +{caretaker.help_categories.length - 5} ostalo
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}

                    {/* INFO O BROJU REZULTATA (uvijek prikaži) */}
                    {!isLoading && caretakerList.length > 0 && (
                        <div className="mt-8 pt-6 border-t">
                            <div className="text-sm text-center text-muted-foreground">
                                Ukupno pronađeno: <span className="font-semibold text-foreground">{totalCount}</span> {totalCount === 1 ? 'CareTaker' : 'CareTakera'}
                            </div>
                        </div>
                    )}

                    {/* PAGINATION KONTROLE (samo ako ima više stranica) */}
                    {!isLoading && caretakerList.length > 0 && totalPages > 1 && (
                        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 pb-2">
                            {/* Info o stranici */}
                            <div className="text-sm text-muted-foreground">
                                Stranica <span className="font-semibold text-foreground">{currentPage}</span> od <span className="font-semibold text-foreground">{totalPages}</span>
                            </div>

                            {/* Previous/Next buttoni */}
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="gap-1"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Prethodna
                                </Button>

                                {/* Page numbers (opcionalno, prikaži samo ako ima manje od 7 stranica) */}
                                {totalPages <= 7 && (
                                    <div className="hidden sm:flex gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                            <Button
                                                key={page}
                                                variant={page === currentPage ? "default" : "ghost"}
                                                size="sm"
                                                onClick={() => handlePageChange(page)}
                                                className="w-9"
                                            >
                                                {page}
                                            </Button>
                                        ))}
                                    </div>
                                )}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage >= totalPages}
                                    className="gap-1"
                                >
                                    Sljedeća
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
