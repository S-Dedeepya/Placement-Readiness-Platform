
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("job_roles")
    .select("id, title, domain, level, description")
    .order("title");

  if (error) {
    return NextResponse.json(
      { error: "Could not retrieve job roles" },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobRoles: data }, { status: 200 });
}
