"use client";

import { useSearchParams } from "next/navigation";
import SignupCaretakerForm from "@/components/signup-caretaker-form";
import { useEffect, useState } from "react";

export default function CompleteCaretakerPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (userId) {
      setIsReady(true);
    }
  }, [userId]);

  if (!isReady || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive">Invalid Access</h2>
          <p className="mt-2 text-muted-foreground">User ID is missing. Please register again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <SignupCaretakerForm userId={userId} />
      </div>
    </div>
  );
}
