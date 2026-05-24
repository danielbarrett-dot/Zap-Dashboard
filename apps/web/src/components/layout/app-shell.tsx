"use client";

import type { PropsWithChildren } from "react";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useCurrentUser } from "@/lib/hooks";

export function AppShell({ children }: PropsWithChildren) {
  const { user } = useCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f6f8f9_0%,_#edf3f7_52%,_#f7fafc_100%)] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
        <Sidebar user={user} />
        <main className="flex-1 space-y-6">
          <Topbar user={user} />
          {children}
        </main>
      </div>
    </div>
  );
}
