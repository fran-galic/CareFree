"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import EmailRequestForm from "@/components/email-request-form";
import { ConfirmRegistrationForm } from "@/components/confirm-registration-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignupPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [email, setEmail] = useState<string | null>(null);

  // If token is present, show confirmation form
  if (token) {
    return <ConfirmRegistrationForm token={token} />;
  }

  if (email) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Check Your Email</CardTitle>
            <CardDescription className="text-base">
              We've sent a registration link to your email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Sent to:</p>
              <p className="font-semibold text-lg">{email}</p>
            </div>
          </CardContent>
        </Card>
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
