// app/search/page.tsx
import { Suspense } from "react";
import SearchPageClient from "./SearchPageClient";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Učitavamo pretragu psihologa...</p>
        </div>
      }
    >
      <SearchPageClient />
    </Suspense>
  );
}
