"use client";

import clsx from "clsx";
import { BarChart3, BriefcaseBusiness, ClipboardList, FileText, KanbanSquare, Link2, LayoutDashboard, ReceiptText, Settings, Tags, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AuthUser, UserRole } from "@/types";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
  permission?: string;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "READ_ONLY", "STAFF"] },
  { href: "/dashboard/jobs", label: "Jobs", icon: ClipboardList, roles: ["ADMIN", "MANAGER", "READ_ONLY", "STAFF"] },
  { href: "/dashboard/matches", label: "Reconciliation", icon: Link2, roles: ["ADMIN", "MANAGER", "READ_ONLY"] },
  { href: "/dashboard/supplier-invoices", label: "Supplier invoices", icon: ReceiptText, roles: ["ADMIN", "MANAGER", "READ_ONLY"], permission: "view_supplier_invoices" },
  { href: "/dashboard/pnl", label: "P&L", icon: FileText, roles: ["ADMIN", "MANAGER", "READ_ONLY"], permission: "view_pnl" },
  { href: "/dashboard/marketing", label: "Marketing", icon: BarChart3, roles: ["ADMIN", "MANAGER", "READ_ONLY"], permission: "view_financials" },
  { href: "/dashboard/job-types", label: "Job types", icon: Tags, roles: ["ADMIN", "MANAGER", "READ_ONLY"], permission: "view_financials" },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: KanbanSquare, roles: ["ADMIN", "MANAGER", "READ_ONLY"], permission: "view_financials" },
  { href: "/dashboard/staff", label: "Staff", icon: UsersRound, roles: ["ADMIN", "MANAGER"] },
  { href: "/dashboard/admin", label: "Admin", icon: Settings, roles: ["ADMIN", "MANAGER"] },
];

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();

  return (
    <aside className="w-full rounded-lg border border-white/70 bg-[#11212a] p-5 text-white shadow-panel lg:sticky lg:top-6 lg:w-72">
      <div className="rounded-lg bg-white/6 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-teal/80">Zap Electrical</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Internal Dashboard</h1>
        <p className="mt-3 text-sm text-slate-300">
          One place for revenue, profit, lead source quality, and booked work.
        </p>
      </div>

      <nav className="mt-8 space-y-2">
        {navItems
          .filter((item) => item.roles.includes(user.role) && (!item.permission || user.role === "ADMIN" || user.permissions[item.permission]))
          .map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "bg-amber text-ink"
                    : "text-slate-200 hover:bg-white/8 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
      </nav>

      <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/10 p-2">
            <BriefcaseBusiness className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-white">{user.name}</p>
            <p>{user.role.toLowerCase()}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
