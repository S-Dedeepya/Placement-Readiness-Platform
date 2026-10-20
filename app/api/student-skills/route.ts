
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

  const { data, error } = await supabase
    .from("student_skills")
    .select(`
      id,
      skill_id,
      proficiency,
      skills (
        skill_name,
        category,
        type
      )
    `)
    .eq("student_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fetch student skills error:", error);

    return NextResponse.json(
      { error: "Could not retrieve student skills" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { studentSkills: data },
    { status: 200 }
  );
}

export async function POST(request: Request) {
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
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { skill_id, proficiency } = body;

  if (
    typeof skill_id !== "string" ||
    skill_id.trim() === "" ||
    !Number.isInteger(proficiency) ||
    proficiency < 1 ||
    proficiency > 10
  ) {
    return NextResponse.json(
      { error: "Provide a valid skill_id and proficiency from 1 to 10" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("student_skills")
    .insert({
      student_id: user.id,
      skill_id,
      proficiency,
    })
    .select(`
      id,
      skill_id,
      proficiency,
      skills (
        skill_name,
        category,
        type
      )
    `)
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You have already added this skill. Update its proficiency instead." },
        { status: 409 }
      );
    }

    if (error.code === "23503") {
      return NextResponse.json(
        { error: "The selected skill does not exist." },
        { status: 400 }
      );
    }

    console.error("Insert student skill error:", error);

    return NextResponse.json(
      { error: "Could not save student skill" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { studentSkill: data },
    { status: 201 }
  );
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
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { skill_id, proficiency } = body;

  if (
    typeof skill_id !== "string" ||
    skill_id.trim() === "" ||
    !Number.isInteger(proficiency) ||
    proficiency < 1 ||
    proficiency > 10
  ) {
    return NextResponse.json(
      { error: "Provide a valid skill_id and proficiency from 1 to 10" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("student_skills")
    .update({
      proficiency,
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", user.id)
    .eq("skill_id", skill_id)
    .select("id, skill_id, proficiency")
    .maybeSingle();

  if (error) {
    console.error("Update student skill error:", error);

    return NextResponse.json(
      { error: "Could not update skill proficiency" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Skill not found in your profile" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { studentSkill: data },
    { status: 200 }
  );
}

export async function DELETE(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const skillId = searchParams.get("skill_id");

  if (!skillId) {
    return NextResponse.json(
      { error: "skill_id query parameter is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("student_skills")
    .delete()
    .eq("student_id", user.id)
    .eq("skill_id", skillId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Delete student skill error:", error);

    return NextResponse.json(
      { error: "Could not delete student skill" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Skill not found in your profile" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { message: "Skill removed successfully" },
    { status: 200 }
  );
}
