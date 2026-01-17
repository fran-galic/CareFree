"use client";

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
  Clock,
  Inbox,
  CalendarDays,
  ArrowRight
} from "lucide-react";

interface CaretakerDashboardProps {
  firstName: string;
}

export function CaretakerDashboard({ firstName }: CaretakerDashboardProps) {
  const router = useRouter();

  const dashboardCards = [
    {
      title: "Zahtjevi studenata",
      description: "Novi zahtjevi za rezervaciju",
      icon: Inbox,
      iconColor: "text-orange-600",
      borderColor: "border-l-orange-500",
      href: "/carefree/requests",
      content: "Pregledajte i odobrite zahtjeve studenata za rezervaciju termina. Ovdje možete vidjeti dodatne informacije o studentu i razlog rezervacije.",
      colSpan: "md:col-span-2"
    },
    {
      title: "Termini (dostupnost)",
      description: "Upravljanje dostupnim terminima",
      icon: Clock,
      iconColor: "text-orange-600",
      borderColor: "border-l-orange-500",
      href: "/carefree/availability",
      content: "Pregled svih zakazanih termina u kalendaru. Postavite svoje slobodne termine i upravljajte susretima sa studentima.",
      colSpan: "md:col-span-1"
    }
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8 animate-in fade-in duration-500">
      
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
          className="md:row-span-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 shadow-md hover:shadow-lg transition-all cursor-pointer group flex flex-col"
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
            <p className="text-lg font-medium text-foreground/80 leading-relaxed">
              Pregledajte i odobrite zahtjeve studenata za rezervaciju termina. Ovdje možete vidjeti dodatne informacije o studentu i razlog rezervacije.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full sm:w-auto gap-2 group-hover:bg-primary/90">
              Pregledaj zahtjeve <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardFooter>
        </Card>

        
        {dashboardCards.slice(1).map((card, index) => {
          const IconComponent = card.icon;
          return (
            <Card 
              key={index}
              className={`border-l-4 ${card.borderColor} hover:shadow-lg transition-all cursor-pointer group`}
              onClick={() => router.push(card.href)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <IconComponent className={`w-6 h-6 ${card.iconColor}`} />
                  {card.title}
                </CardTitle>
                <CardDescription className="text-base">
                  {card.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {card.content}
                </p>
                <div className="flex items-center gap-2 text-primary text-sm font-medium group-hover:gap-3 transition-all">
                  Otvori <ArrowRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Brzi savjeti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Redovito ažurirajte svoju dostupnost kako bi studenti mogli lakše rezervirati termine.</p>
          <p>• Odgovorite na zahtjeve studenata u roku od 24 sata za bolju korisničku procjenu.</p>
          <p>• Provjerite svoj profil i osigurajte da su sve informacije ažurne.</p>
        </CardContent>
      </Card>
    </div>
  );
}
