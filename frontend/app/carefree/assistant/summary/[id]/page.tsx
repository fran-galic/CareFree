"use client";

import { useRouter } from "next/navigation";
import React from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { AssistantSummaryDetail } from "@/fetchers/assistant";
import { BACKEND_URL } from "@/lib/config";

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function AssistantSummaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const { data: summary, error, isLoading } = useSWR<AssistantSummaryDetail>(
    `${BACKEND_URL}/assistant/summaries/${id}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-12 max-w-3xl px-6">
        <Alert variant="destructive">
          <AlertDescription>Greška pri dohvaćanju detalja sesije.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("hr-HR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto py-12 max-w-4xl px-6">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Natrag
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Detalji sesije</CardTitle>
              <CardDescription className="mt-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {summary.created_at && formatDate(summary.created_at)}
              </CardDescription>
            </div>
            {summary.main_category && (
              <Badge variant="secondary" className="text-sm">
                {summary.main_category}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{summary.summary_type}</Badge>
            {summary.subcategories.map((subcategory) => (
              <Badge key={subcategory} variant="outline">
                {subcategory}
              </Badge>
            ))}
          </div>

          {/* Sažetak */}
          {summary.summary_text && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Sažetak razgovora</h3>
              <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                {summary.summary_text}
              </p>
            </div>
          )}

          <Separator />

          {/* Preporučeni caretakeri */}
          {summary.recommended_caretakers && summary.recommended_caretakers.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3">Preporučeni psiholozi</h3>
              <div className="grid gap-3">
                {summary.recommended_caretakers.map((caretaker) => (
                  <Card key={caretaker.user_id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">
                            {caretaker.first_name} {caretaker.last_name}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {caretaker.about_me || "Psiholog"}
                          </p>
                          {caretaker.help_categories && caretaker.help_categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {caretaker.help_categories.map((cat: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {cat}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => router.push(`/carefree/caretaker/${caretaker.user_id}`)}
                        >
                          Vidi profil
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
