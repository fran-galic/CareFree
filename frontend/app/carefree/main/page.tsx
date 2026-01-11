"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/fetchers/fetcher";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentDashboard } from "@/components/student-dashboard";
import { CaretakerDashboard } from "@/components/caretaker-dashboard";

const BACKEND_API = process.env.NEXT_PUBLIC_BACKEND_URL;

interface User {
  first_name: string;
  role: string;
}

export default function MainPage() {
  const router = useRouter();

  const { data: user, isLoading: userLoading, error: userError } = useSWR<User>(
    `${BACKEND_API}/users/me/`, 
    fetcher,
    {
      revalidateOnMount: true,
      dedupingInterval: 0
    }
  );

  useEffect(() => {
    if (userError && userError.message.includes('401') && !userLoading) {
      router.push('/accounts/login');
    }
  }, [userError, userLoading, router]);

  if (userLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl space-y-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!user) return null;

  if (user.role === "caretaker") {
    return <CaretakerDashboard firstName={user.first_name} />;
  }

  return <StudentDashboard firstName={user.first_name} />;
}