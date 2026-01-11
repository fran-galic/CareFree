"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function RequestsPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/carefree/main">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Zahtjevi studenata</h1>
          <p className="text-muted-foreground">Pregled i upravljanje zahtjevima za rezervaciju termina</p>
        </div>
      </div>

      <Card className="border-orange-500/20 bg-orange-50/50 dark:bg-orange-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600">
            <Inbox className="w-8 h-8" />
            Uskoro
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
