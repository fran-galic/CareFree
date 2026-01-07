"use client";
import { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Mail, Clock } from "lucide-react";

export default function SignupPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [email, setEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isResending, setIsResending] = useState<boolean>(false);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;

    setIsResending(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/register/request-email/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        }
      );

      if (response.ok) {
        setResendCooldown(60);
      }
    } catch (err) {
      console.error("Resend failed:", err);
    } finally {
      setIsResending(false);
    }
  };

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
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Sent to:</p>
              <p className="font-semibold text-lg">{email}</p>
            </div>

            <div className="pt-2 space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Didn't receive the email? Check your spam folder or resend it.
              </p>
              
              <Button
                onClick={handleResend}
                disabled={resendCooldown > 0 || isResending}
                variant="outline"
                className="w-full"
              >
                {isResending ? (
                  <>
                    <Mail className="mr-2 h-4 w-4 animate-pulse" />
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Resend in {resendCooldown}s
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Resend Email
                  </>
                )}
              </Button>
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
