"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/fetchers/fetcher";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MessageCircle, 
  BookOpen, 
  CalendarDays, 
  Search, 
  ArrowRight, 
  Smile,
  Zap
} from "lucide-react";

const BACKEND_API = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Summary {
  id: number;
  content: string;
  created_at: string;
}

interface StudentDashboardProps {
  firstName: string;
}

export function StudentDashboard({ firstName }: StudentDashboardProps) {
  const router = useRouter();

  // Dohvat sažetaka razgovora (History)
  const { data: summaries, isLoading: summariesLoading } = useSWR<Summary[]>(
    `${BACKEND_API}/assistant/summaries`, 
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("hr-HR", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8 animate-in fade-in duration-500">
      
      {/* 1. POZDRAVNA SEKCIJA */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">
          Bok, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground text-lg">
          Dobrodošao/la u svoj sigurni kutak. Kako ti možemo pomoći danas?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 2. GLAVNA KARTICA: AI CHAT (Zauzima 2 stupca) */}
        <Card className="md:col-span-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 shadow-md hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => router.push("/carefree/messages")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl text-primary">
              <MessageCircle className="w-8 h-8" />
              AI Asistent
            </CardTitle>
            <CardDescription className="text-base">
              Tvoj anonimni sugovornik dostupan 24/7.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium text-foreground/80 leading-relaxed">
              "Osjećaš se preplavljeno ili samo trebaš nekoga za razgovor? 
              Ovdje sam da te saslušam bez osude."
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full sm:w-auto gap-2 group-hover:bg-primary/90">
              Započni razgovor <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardFooter>
        </Card>

        {/* 3. DESNI STUPAC: QUICK ACTIONS */}
        <div className="flex flex-col gap-6">
          
          {/* STATUS TERMINA / PSIHOLOG */}
          <Card className="flex-1 flex flex-col justify-between border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="w-5 h-5 text-primary" />
                Sljedeći termin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm mb-3">Nemaš zakazanih termina.</p>
                <Link href="/carefree/search">
                  <Button variant="outline" size="sm" className="w-full gap-2 border-dashed">
                    <Search className="w-4 h-4" /> Pronađi stručnjaka
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* DNEVNIK */}
          <Card className="flex-1 border-l-4 border-l-primary cursor-pointer hover:bg-accent/5 transition-colors"
                 onClick={() => router.push("/carefree/journal")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="w-5 h-5 text-primary" />
                Moj Dnevnik
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Zapiši svoje misli i prati raspoloženje. Sve je enkriptirano.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. DONJA SEKCIJA: POVIJEST RAZGOVORA (Summaries) */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Nedavni uvidi
          </h2>
          <Link href="/carefree/messages" className="text-sm text-primary hover:underline">
            Povijest razgovora &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summariesLoading ? (
             [1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          ) : summaries && summaries.length > 0 ? (
            summaries.slice(0, 3).map((summary) => (
              <Card key={summary.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-mono">
                    {formatDate(summary.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {summary.content}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="col-span-full border-dashed p-8 text-center text-muted-foreground bg-muted/20">
              <Smile className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>Još nemaš spremljenih sažetaka razgovora.</p>
              <p className="text-sm">Razgovaraj s AI asistentom da bi dobio uvide.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
