
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get("roleId");

  if (!roleId) {
    return NextResponse.json(
      { error: "roleId query parameter is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("role_skill_requirements")
    .select(`
      role_id,
      skill_id,
      required_proficiency,
      importance,
      skills (
        id,
        skill_name,
        type,
        category,
        description
      )
    `)
    .eq("role_id", roleId)
    .order("skill_id");

  if (error) {
    return NextResponse.json(
      { error: "Could not retrieve role skill requirements" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { requirements: data },
    { status: 200 }
  );
}
