
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("skills")
    .select("id, skill_name, type, category, description")
    .order("skill_name");

  if (error) {
    return NextResponse.json(
      { error: "Could not retrieve skills" },
      { status: 500 }
    );
  }

  return NextResponse.json({ skills: data }, { status: 200 });
}
