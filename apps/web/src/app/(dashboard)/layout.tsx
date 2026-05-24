import type { PropsWithChildren } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
