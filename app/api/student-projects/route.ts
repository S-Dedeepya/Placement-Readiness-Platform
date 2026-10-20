
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
    .from("student_projects")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch projects error:", error);
    return NextResponse.json(
      { error: "Could not retrieve projects" },
      { status: 500 }
    );
  }

  return NextResponse.json({ projects: data }, { status: 200 });
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

  const {
    project_name,
    description,
    tech_stack,
    repository_url,
  } = body;

  if (
    typeof project_name !== "string" ||
    !project_name.trim()
  ) {
    return NextResponse.json(
      { error: "Project name is required" },
      { status: 400 }
    );
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    return NextResponse.json(
      { error: "Description must be text" },
      { status: 400 }
    );
  }

  if (
    !Array.isArray(tech_stack ?? []) ||
    !(tech_stack ?? []).every(
      (item: unknown) =>
        typeof item === "string" && item.trim().length > 0
    )
  ) {
    return NextResponse.json(
      { error: "Tech stack must be an array of strings" },
      { status: 400 }
    );
  }

  if (
    repository_url !== undefined &&
    repository_url !== null &&
    repository_url !== "" &&
    (
      typeof repository_url !== "string" ||
      !URL.canParse(repository_url) ||
      !["http:", "https:"].includes(
        new URL(repository_url).protocol
      )
    )
  ) {
    return NextResponse.json(
      { error: "Repository URL must be a valid HTTP or HTTPS URL" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("student_projects")
    .insert({
      student_id: user.id,
      project_name: project_name.trim(),
      description: description?.trim() || null,
      tech_stack: (tech_stack ?? []).map(
        (item: string) => item.trim()
      ),
      repository_url: repository_url?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Create project error:", error);
    return NextResponse.json(
      { error: "Could not save project" },
      { status: 500 }
    );
  }

  return NextResponse.json({ project: data }, { status: 201 });
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

  const { id, project_name, description, tech_stack, repository_url } = body;

  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "A valid project id is required" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (project_name !== undefined) {
    if (typeof project_name !== "string" || !project_name.trim()) {
      return NextResponse.json(
        { error: "Project name cannot be empty" },
        { status: 400 }
      );
    }
    updates.project_name = project_name.trim();
  }

  if (description !== undefined) {
    if (description !== null && typeof description !== "string") {
      return NextResponse.json(
        { error: "Description must be text or null" },
        { status: 400 }
      );
    }
    updates.description = description?.trim() || null;
  }

  if (tech_stack !== undefined) {
    if (
      !Array.isArray(tech_stack) ||
      !tech_stack.every(
        (item: unknown) => typeof item === "string" && item.trim()
      )
    ) {
      return NextResponse.json(
        { error: "Tech stack must be an array of non-empty strings" },
        { status: 400 }
      );
    }
    updates.tech_stack = tech_stack.map((item: string) => item.trim());
  }

  if (repository_url !== undefined) {
    if (
      repository_url !== null &&
      repository_url !== "" &&
      (
        typeof repository_url !== "string" ||
        !URL.canParse(repository_url) ||
        !["http:", "https:"].includes(new URL(repository_url).protocol)
      )
    ) {
      return NextResponse.json(
        { error: "Repository URL must be a valid HTTP or HTTPS URL" },
        { status: 400 }
      );
    }
    updates.repository_url = repository_url?.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one field to update" },
      { status: 400 }
    );
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("student_projects")
    .update(updates)
    .eq("id", id)
    .eq("student_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Update project error:", error);
    return NextResponse.json(
      { error: "Could not update project" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Project not found in your profile" },
      { status: 404 }
    );
  }

  return NextResponse.json({ project: data }, { status: 200 });
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
  const idParam = searchParams.get("id");
  const id = Number(idParam);

  if (!idParam || !Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "A valid project id query parameter is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("student_projects")
    .delete()
    .eq("id", id)
    .eq("student_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Delete project error:", error);
    return NextResponse.json(
      { error: "Could not delete project" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Project not found in your profile" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { message: "Project deleted successfully" },
    { status: 200 }
  );
}
