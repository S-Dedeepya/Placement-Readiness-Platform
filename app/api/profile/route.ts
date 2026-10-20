
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not retrieve profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({
  profile: {
    ...profile,
    email: user.email ?? "",
  },
});
}

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const allowedFields = [
    "full_name",
    "year_of_study",
    "branch",
    "cgpa",
    "college",
  ] as const;

  const updates: Record<string, string | number | null> = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one valid profile field." },
      { status: 400 }
    );
  }

  if (
    "full_name" in updates &&
    (typeof updates.full_name !== "string" ||
      !updates.full_name.trim())
  ) {
    return NextResponse.json(
      { error: "Full name cannot be empty." },
      { status: 400 }
    );
  }

  if (
    "cgpa" in updates &&
    updates.cgpa !== null &&
    (typeof updates.cgpa !== "number" ||
      !Number.isFinite(updates.cgpa) ||
      updates.cgpa < 0 ||
      updates.cgpa > 10)
  ) {
    return NextResponse.json(
      { error: "CGPA must be a number between 0 and 10, or null." },
      { status: 400 }
    );
  }

  for (const field of ["year_of_study", "branch", "college"] as const) {
    if (
      field in updates &&
      updates[field] !== null &&
      typeof updates[field] !== "string"
    ) {
      return NextResponse.json(
        { error: `${field} must be a string or null.` },
        { status: 400 }
      );
    }
  }

  if (typeof updates.full_name === "string") {
    updates.full_name = updates.full_name.trim();
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not update profile." },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile }, { status: 200 });
}
