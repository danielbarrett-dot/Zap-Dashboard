"use client";

import { LockKeyhole, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("admin@zap-electrical.co.uk");
  const [password, setPassword] = useState("AdminPass123!");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = searchParams.get("next");
  const safeNextPath =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          totpCode: totpCode || undefined
        })
      });

      router.replace(safeNextPath);
      router.refresh();
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to sign in right now.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#0f1720_0%,_#172936_52%,_#1f3640_100%)] px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-white/10 bg-white/5 p-8 text-white shadow-panel backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-teal/80">Zap Electrical</p>
          <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-tight tracking-tight">
            Run the business from one secure dashboard.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            Revenue, profit, lead source quality, job performance, and the next eight weeks of booked work in one internal control room.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { label: "ServiceM8 sync", value: "Jobs, time, lead source, materials" },
              { label: "QuickBooks sync", value: "Invoices, payments, matching" },
              { label: "Permissions", value: "Admin, manager, staff-safe views" }
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <p className="mt-3 text-sm text-slate-200">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/70 bg-sand p-8 shadow-panel">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal">Secure sign in</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-3 text-sm text-slate-600">
            Sample accounts are pre-seeded for local setup. Swap them for real users in production.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <div className="mt-2 flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
                <UserRound className="h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent outline-none"
                  required
                />
              </div>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Password
              <div className="mt-2 flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
                <LockKeyhole className="h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent outline-none"
                  required
                />
              </div>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              2FA code
              <input
                type="text"
                inputMode="numeric"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none ring-teal transition focus:ring"
                placeholder="Only needed if enabled"
              />
            </label>

            {error ? <p className="rounded-md bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-slate-200 bg-white/70 p-4 text-sm text-slate-600">
            <p className="font-semibold text-ink">Local seeded accounts</p>
            <p className="mt-2">
              <code>admin@zap-electrical.co.uk</code> / <code>AdminPass123!</code>
            </p>
            <p>
              <code>manager@zap-electrical.co.uk</code> / <code>ManagerPass123!</code>
            </p>
            <p>
              <code>readonly@zap-electrical.co.uk</code> / <code>ReadOnlyPass123!</code>
            </p>
            <p>
              <code>staff@zap-electrical.co.uk</code> / <code>StaffPass123!</code>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
