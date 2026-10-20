
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SignupPage() {
  const [year, setYear] = useState("");
  const [branch, setBranch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const form = new FormData(event.currentTarget);

    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const college = String(form.get("college") ?? "").trim();
    const collegeLocation = String(
      form.get("collegeLocation") ?? ""
    ).trim();
    const cgpa = Number(form.get("cgpa"));
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (!year || !branch) {
      setMessage("Please select your year of study and branch.");
      return;
    }

    if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) {
      setMessage("CGPA must be between 0 and 10.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            year_of_study: year,
            branch,
            cgpa,
            college,
            college_location: collegeLocation,
          },
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.session) {
        setMessage("Account created successfully! You can now log in.");
      } else {
        setMessage(
          "Registration received! Check your email to confirm your account before logging in."
        );
      }

      event.currentTarget.reset();
      setYear("");
      setBranch("");
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-black p-6">
      <Card className="w-full max-w-sm border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        <CardHeader>
          <CardTitle>
            <b>Sign Up</b>
          </CardTitle>
          <CardDescription>
            Create your account to get started.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSignup}>
          <CardContent>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" required
                  placeholder="Enter your full name"
                  className="border-zinc-700 bg-zinc-900" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required
                  placeholder="m@example.com"
                  className="border-zinc-700 bg-zinc-900" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="college">College Name</Label>
                <Input id="college" name="college" required
                  placeholder="Enter your college name"
                  className="border-zinc-700 bg-zinc-900" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="year">Year of Study</Label>
<Select
  value={year}
  onValueChange={(value) => setYear(value ?? "")}
>                  <SelectTrigger id="year" className="w-full border-zinc-700 bg-zinc-900">
                    <SelectValue placeholder="Select your year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1st Year</SelectItem>
                    <SelectItem value="2">2nd Year</SelectItem>
                    <SelectItem value="3">3rd Year</SelectItem>
                    <SelectItem value="4">4th Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="branch">Branch</Label>
<Select
  value={branch}
  onValueChange={(value) => setBranch(value ?? "")}
>                  <SelectTrigger id="branch" className="w-full border-zinc-700 bg-zinc-900">
                    <SelectValue placeholder="Select your branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CSE">CSE</SelectItem>
                    <SelectItem value="CSE(DS)">CSE (DS)</SelectItem>
                    <SelectItem value="CSE(AIML)">CSE (AI/ML)</SelectItem>
                    <SelectItem value="CSE(CS)">CSE (CS)</SelectItem>
                    <SelectItem value="ECE">ECE</SelectItem>
                    <SelectItem value="EEE">EEE</SelectItem>
                    <SelectItem value="ME">ME</SelectItem>
                    <SelectItem value="CE">CE</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cgpa">Current CGPA</Label>
                <Input id="cgpa" name="cgpa" type="number"
                  min="0" max="10" step="0.01" required
                  placeholder="e.g. 8.5"
                  className="border-zinc-700 bg-zinc-900" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Create Password</Label>
                <Input id="password" name="password" type="password"
                  minLength={8} autoComplete="new-password" required
                  placeholder="At least 8 characters"
                  className="border-zinc-700 bg-zinc-900" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Re-enter Password</Label>
                <Input id="confirmPassword" name="confirmPassword"
                  type="password" minLength={8}
                  autoComplete="new-password" required
                  placeholder="Enter your password again"
                  className="border-zinc-700 bg-zinc-900" />
              </div>

              {message && (
                <p role="status" aria-live="polite" className="text-sm text-zinc-300">
                  {message}
                </p>
              )}

              <Button type="submit" disabled={loading}
                className="w-full">
                {loading ? "Creating Account..." : "Create Account"}
              </Button>
            </div>
          </CardContent>

          <CardFooter className="flex-col items-center gap-2 border-t border-zinc-800 bg-zinc-950 pt-4">
            <p className="text-sm text-zinc-400">
              Already have an account?{" "}
              <Link href="/"
                className="font-medium text-white underline underline-offset-4 hover:text-blue-400">
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
