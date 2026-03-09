"use client";

import { useState } from "react";

import EmailRequestForm from "@/components/email-request-form";

export default function TestEmailPage() {
  const [email, setEmail] = useState<string | null>(null);

  if (email) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold">Email Sent!</h2>
          <p className="mb-2 text-muted-foreground">
            Registration token sent to: <strong>{email}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Check the backend console for the registration link with token.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <EmailRequestForm onSuccess={setEmail} />
      </div>
    </div>
  );
}
