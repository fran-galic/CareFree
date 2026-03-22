"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Card, 
  CardContent, 
  CardDescription,
  CardFooter,
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Inbox,
  CalendarDays,
  CalendarCheck,
  ArrowRight,
  Info
} from "lucide-react";

interface CaretakerDashboardProps {
  firstName: string;
}

export function CaretakerDashboard({ firstName }: CaretakerDashboardProps) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/carefree/requests");
    router.prefetch("/carefree/availability");
    router.prefetch("/carefree/dostupnost");
  }, [router]);

  return (
    <div className="container mx-auto max-w-6xl animate-in space-y-6 p-6 fade-in duration-500">
      
      {/* POZDRAVNA SEKCIJA */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">
          Bok, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground text-lg">
          Dobrodošli u vaš prostor za upravljanje terminima i komunikaciju sa studentima.
        </p>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <Card
          className="group flex cursor-pointer flex-col border-primary/15 border-t-[3px] border-l-[3px] border-t-primary/50 border-l-primary/50 bg-[linear-gradient(180deg,rgba(231,244,241,0.5)_0%,rgba(255,255,255,1)_22%)] transition-all hover:-translate-y-0.5 md:row-span-2"
          onClick={() => router.push("/carefree/requests")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl text-primary">
              <Inbox className="w-8 h-8" />
              Zahtjevi studenata
            </CardTitle>
            <CardDescription className="text-base">
              Novi zahtjevi za rezervaciju
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-lg font-medium leading-relaxed text-foreground/80">
              Pregledajte i odobrite zahtjeve studenata za rezervaciju termina. Ovdje možete vidjeti dodatne informacije o studentu i razlog rezervacije.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full sm:w-auto gap-2 group-hover:bg-primary/90">
              Pregledaj zahtjeve <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardFooter>
        </Card>

        <Card
          className="group cursor-pointer border border-border/80 border-t-[3px] border-l-[3px] border-t-primary/40 border-l-primary/40 bg-[linear-gradient(180deg,rgba(231,244,241,0.34)_0%,rgba(255,255,255,1)_28%)] transition-all hover:-translate-y-0.5 hover:border-primary/25"
          onClick={() => router.push("/carefree/availability")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary shadow-sm">
                <CalendarDays className="h-5 w-5" />
              </span>
              Termini
            </CardTitle>
            <CardDescription className="text-base">Pregled zakazanih termina</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Pregled svih zakazanih termina u kalendaru. Upravljajte susretima sa studentima.
            </p>
            <div className="flex items-center gap-2 text-sm font-medium text-primary transition-all group-hover:gap-3">
              Otvori <ArrowRight className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer border border-border/80 border-t-[3px] border-l-[3px] border-t-primary/40 border-l-primary/40 bg-[linear-gradient(180deg,rgba(231,244,241,0.34)_0%,rgba(255,255,255,1)_28%)] transition-all hover:-translate-y-0.5 hover:border-primary/25"
          onClick={() => router.push("/carefree/dostupnost")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary shadow-sm">
                <CalendarCheck className="h-5 w-5" />
              </span>
              Dostupnost
            </CardTitle>
            <CardDescription className="text-base">Postavi dostupne satnice</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Postavite svoje dostupne termine. Kliknite na satnice kada ste dostupni za razgovore sa studentima.
            </p>
            <div className="flex items-center gap-2 text-sm font-medium text-primary transition-all group-hover:gap-3">
              Otvori <ArrowRight className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      
      <div className="rounded-xl border border-[#eadfc3] bg-[linear-gradient(180deg,rgba(251,246,236,0.96)_0%,rgba(255,255,255,0.98)_100%)] p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#b7791f]" />
          <div>
            <h2 className="text-lg font-semibold text-[#6b4f1d]">Brzi savjeti</h2>
            <div className="mt-2 space-y-2 text-sm text-[#8a7448]">
              <p>• Redovito ažurirajte svoju dostupnost kako bi studenti mogli lakše rezervirati termine.</p>
              <p>• Odgovorite na zahtjeve studenata u roku od 24 sata za bolju korisničku procjenu.</p>
              <p>• Provjerite svoj profil i osigurajte da su sve informacije ažurne.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
