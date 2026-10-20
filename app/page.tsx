
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  
async function handleGoogleLogin() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    setMessage(error.message);
  }
}

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-black p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-wide text-white sm:text-3xl">
          Placement Readiness Platform
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your placement preparation journey starts here.
        </p>
      </div>

      <Card className="w-full max-w-sm border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        <CardHeader>
          <CardTitle>
            <b>Login to your account</b>
          </CardTitle>

          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>

          <CardAction>
            <Button
              variant="link"
              className="text-zinc-100 underline underline-offset-4 hover:text-white"
            >
              <Link href="/signup">Sign Up</Link>
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          <form id="login-form" onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="m@example.com"
                  className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-500"
                  required
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>

                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-500"
                  required
                />
              </div>

              {message && (
                <p role="status" className="text-sm text-red-400">
                  {message}
                </p>
              )}
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex-col items-center gap-2 border-t border-zinc-800 bg-zinc-950 pt-4">
          <Button
            type="submit"
            form="login-form"
            disabled={loading}
            variant="outline"
            className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
          >
            {loading ? "Logging in..." : "Login"}
          </Button>

          <Button
  type="button"
  variant="outline"
  className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
  onClick={handleGoogleLogin}
>
  Continue with Google
</Button>
        </CardFooter>
      </Card>
    </main>
  );
}
