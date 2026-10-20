
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session?.user) {
        router.replace("/");
        return;
      }

      const user = data.session.user;

      // Check whether the user has a completed student profile.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, college, year_of_study, branch, cgpa")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile check failed:", profileError.message);
        router.replace("/");
        return;
      }

      const hasCompletedProfile =
        !!profile?.full_name?.trim() &&
        !!profile?.college?.trim() &&
        !!profile?.year_of_study &&
        !!profile?.branch &&
        profile?.cgpa !== null &&
        profile?.cgpa !== undefined;

      if (hasCompletedProfile) {
        router.replace("/dashboard");
      } else {
        router.replace("/signup");
      }
    }

    handleCallback();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      Checking your account...
    </main>
  );
}
