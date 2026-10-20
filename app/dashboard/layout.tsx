
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  const activeClass =
    "rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950";

  const inactiveClass =
    "rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white";
  const router = useRouter();
const [loggingOut, setLoggingOut] = useState(false);

async function handleLogout() {
  setLoggingOut(true);

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Logout failed:", error.message);
    setLoggingOut(false);
    return;
  }

  router.replace("/");
  router.refresh();
}
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="mt-2 text-3xl font-bold">
            Placement Readiness Platform
          </h1>

          <nav className="flex gap-2">
            <Link
              href="/dashboard"
              className={
                pathname === "/dashboard"
                  ? activeClass
                  : inactiveClass
              }
            >
              Dashboard
            </Link>

            <Link
              href="/dashboard/profile"
              className={
                pathname.startsWith("/dashboard/profile")
                  ? activeClass
                  : inactiveClass
              }
            >
              My Profile
            </Link>
            <button
  type="button"
  onClick={handleLogout}
  disabled={loggingOut}
  className="rounded-lg px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
>
  {loggingOut ? "Logging out..." : "Log Out"}
</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}