"use client";

import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import SearchBar from "@/components/search-bar";
import { searchCaretakers, getHelpCategories } from "@/fetchers/users";
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filter, Briefcase, Clock, ChevronRight, Stethoscope } from 'lucide-react';

export default function SearchPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const q = searchParams.get("q") ?? "";
  const categoriesParam = searchParams.getAll("categories");

  const { data: categoriesData } = useSWR('help-categories', getHelpCategories);
  
  const { data: caretakersData, isLoading } = useSWR(
    [`search`, q, categoriesParam], 
    ([_, query, cats]) => searchCaretakers(query, cats)
  );

  const caretakerList = caretakersData?.results ?? [];

  const handleCategoryChange = (slug: string, isChecked: boolean) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (isChecked) {
        current.append("categories", slug);
    } else {
        current.delete("categories");
        const newCats = categoriesParam.filter(c => c !== slug);
        newCats.forEach(c => current.append("categories", c));
    }
    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${pathname}${query}`);
  };

  return (
    <div className="container mx-auto py-10 min-h-screen px-4 max-w-7xl">
      
      {/* HEADER SEKCIJA */}
      <div className="mb-10 text-center md:text-left space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">
            Pronađi svog stručnjaka
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
            Pretražite našu bazu licenciranih psihologa i pronađite osobu s kojom se osjećate sigurno.
        </p>
        <div className="max-w-xl pt-2">
             <SearchBar initial={q} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* SIDEBAR FILTERI - STICKY POZICIJA */}
        <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-8 h-fit">
            <div className="bg-card border rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4 text-primary font-semibold">
                    <Filter className="w-5 h-5" /> 
                    <span className="text-lg">Filtriraj po problemu</span>
                </div>
                <Separator className="mb-4" />
                
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {categoriesData?.categories.map((cat) => (
                        <div key={cat.id}>
                            <h4 className="font-bold text-sm mb-3 text-foreground/80 uppercase tracking-wide">
                                {cat.label}
                            </h4>
                            <div className="space-y-2.5">
                                <div className="flex items-center space-x-3 group">
                                    <Checkbox 
                                        id={cat.slug} 
                                        checked={categoriesParam.includes(cat.slug)}
                                        onCheckedChange={(checked) => handleCategoryChange(cat.slug, checked as boolean)}
                                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-colors"
                                    />
                                    <Label htmlFor={cat.slug} className="text-sm cursor-pointer group-hover:text-primary transition-colors font-medium">
                                        Sve iz {cat.label}
                                    </Label>
                                </div>
                                {cat.subcategories.map(sub => (
                                    <div key={sub.id} className="flex items-center space-x-3 ml-3 group pl-2 border-l-2 border-muted hover:border-primary/50 transition-colors">
                                        <Checkbox 
                                            id={sub.slug}
                                            checked={categoriesParam.includes(sub.slug)}
                                            onCheckedChange={(checked) => handleCategoryChange(sub.slug, checked as boolean)}
                                        />
                                        <Label htmlFor={sub.slug} className="text-sm text-muted-foreground cursor-pointer group-hover:text-foreground transition-colors">
                                            {sub.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* LISTA REZULTATA */}
        <div className="lg:col-span-9">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-muted-foreground">Tražimo najbolje stručnjake za vas...</p>
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
                                            <AvatarImage src={caretaker.user_image_url || ""} className="object-cover" />
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
                                            {caretaker.specialisation || "Nema dodatnog opisa specijalizacije."}
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
                </div>
            )}
        </div>
      </div>
    </div>
  );
}