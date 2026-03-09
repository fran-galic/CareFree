"use client"

import { useSearchParams } from "next/navigation"
import SignupCaretakerForm from "@/components/signup-caretaker-form"
import { Suspense } from "react"

function CompleteCaretakerContent() {
  const searchParams = useSearchParams()
  const userId = searchParams.get("userId")

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive">
            Invalid Access
          </h2>
          <p className="mt-2 text-muted-foreground">
            User ID is missing. Please register again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <SignupCaretakerForm userId={userId} />
      </div>
    </div>
  )
}

export default function CompleteCaretakerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-muted-foreground">Učitavanje...</p>
          </div>
        </div>
      }
    >
      <CompleteCaretakerContent />
    </Suspense>
  )
}
