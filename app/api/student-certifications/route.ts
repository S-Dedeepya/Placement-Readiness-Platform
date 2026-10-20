
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
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
      .from("student_certifications")
      .select("*")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ certifications: data }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const body = await request.json();

    const certificationName = body.certification_name;
    const issuer = body.issuer;
    const earnedDate = body.earned_date;

    if (
      typeof certificationName !== "string" ||
      !certificationName.trim() ||
      typeof issuer !== "string" ||
      !issuer.trim()
    ) {
      return NextResponse.json(
        { error: "Certification name and issuer are required." },
        { status: 400 }
      );
    }

    if (
      earnedDate !== undefined &&
      earnedDate !== null &&
      (typeof earnedDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(earnedDate) ||
        Number.isNaN(Date.parse(`${earnedDate}T00:00:00Z`)))
    ) {
      return NextResponse.json(
        { error: "earned_date must use YYYY-MM-DD format or be null." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("student_certifications")
      .insert({
        student_id: user.id,
        certification_name: certificationName.trim(),
        issuer: issuer.trim(),
        earned_date: earnedDate ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ certification: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request or internal server error." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
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

    const body = await request.json();
    const { id, certification_name, issuer, earned_date } = body;

    if (
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        { error: "A valid certification id is required." },
        { status: 400 }
      );
    }

    const updates: Record<string, string | null> = {};

    if (certification_name !== undefined) {
      if (
        typeof certification_name !== "string" ||
        !certification_name.trim()
      ) {
        return NextResponse.json(
          { error: "Certification name cannot be empty." },
          { status: 400 }
        );
      }

      updates.certification_name = certification_name.trim();
    }

    if (issuer !== undefined) {
      if (typeof issuer !== "string" || !issuer.trim()) {
        return NextResponse.json(
          { error: "Issuer cannot be empty." },
          { status: 400 }
        );
      }

      updates.issuer = issuer.trim();
    }

    if (earned_date !== undefined) {
      if (
        earned_date !== null &&
        (typeof earned_date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(earned_date) ||
          Number.isNaN(Date.parse(`${earned_date}T00:00:00Z`)))
      ) {
        return NextResponse.json(
          { error: "earned_date must use YYYY-MM-DD format or be null." },
          { status: 400 }
        );
      }

      updates.earned_date = earned_date;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update." },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("student_certifications")
      .update(updates)
      .eq("id", id)
      .eq("student_id", user.id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Certification not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ certification: data }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request or internal server error." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
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

    if (
      !idParam ||
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        { error: "A valid certification id is required in the query." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("student_certifications")
      .delete()
      .eq("id", id)
      .eq("student_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Certification not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Certification deleted successfully." },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
