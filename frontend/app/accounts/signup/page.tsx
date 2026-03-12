"use client"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import EmailRequestForm from "@/components/email-request-form"
import { ConfirmRegistrationForm } from "@/components/confirm-registration-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Clock } from "lucide-react"

function SignupContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  const [email, setEmail] = useState<string | null>(null)
  const [googleUser, setGoogleUser] = useState<{ email: string } | null>(null)
  const [resendCooldown, setResendCooldown] = useState<number>(0)
  const [isResending, setIsResending] = useState<boolean>(false)
  const [isChecking, setIsChecking] = useState(true)

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/users/me/`,
          {
            credentials: "include",
          }
        )

        if (response.ok) {
          const user = await response.json()
          if (user.needs_onboarding) {
            setGoogleUser({ email: user.email })
            setIsChecking(false)
            return
          }
          router.replace("/carefree/main")
        } else {
          setIsChecking(false)
        }
      } catch {
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      )
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return

    setIsResending(true)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/register/request-email/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        }
      )

      if (response.ok) {
        setResendCooldown(60)
      }
    } catch (err) {
      console.error("Resend failed:", err)
    } finally {
      setIsResending(false)
    }
  }

  // Show loading while checking auth
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Provjera prijave...</p>
        </div>
      </div>
    )
  }

  // If token is present, show confirmation form
  if (token) {
    return <ConfirmRegistrationForm token={token} />
  }

  if (googleUser) {
    return <ConfirmRegistrationForm email={googleUser.email} isGoogleOnboarding />
  }

  if (email) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Provjerite email</CardTitle>
            <CardDescription className="text-base">
              Poslali smo link za registraciju na vašu email adresu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Poslano na:</p>
              <p className="font-semibold text-lg">{email}</p>
            </div>

            <div className="pt-2 space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Niste primili email? Provjerite spam folder ili pošaljite
                ponovno.
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
                    Šalje se...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Pošalji ponovno za {resendCooldown}s
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Pošalji ponovno
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <EmailRequestForm onSuccess={setEmail} />
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Učitavanje...</p>
          </div>
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  )
}
