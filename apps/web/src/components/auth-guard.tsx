"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";

import { LoadingBlock } from "./loading-block";
import { useCurrentUser } from "@/lib/hooks";

export function AuthGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, error } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && (!user || error)) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [error, isLoading, pathname, router, user]);

  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <LoadingBlock label="Checking your secure session..." />
      </div>
    );
  }

  return <>{children}</>;
}

