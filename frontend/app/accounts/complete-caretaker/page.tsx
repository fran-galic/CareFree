"use client"

import { useSearchParams } from "next/navigation"
import SignupCaretakerForm from "@/components/signup-caretaker-form"
import { useEffect, useState, Suspense } from "react"

function CompleteCaretakerContent() {
  const searchParams = useSearchParams()
  const userId = searchParams.get("userId")
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (userId) {
      setIsReady(true)
    }
  }, [userId])

  if (!isReady || !userId) {
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
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Učitavanje...</p>
          </div>
        </div>
      }
    >
      <CompleteCaretakerContent />
    </Suspense>
  )
}
