
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const {
      email,
      password,
      full_name,
      college,
      branch,
      year_of_study,
      cgpa,
    } = await request.json();

    // Validate required fields
    if (
      !email ||
      !password ||
      !full_name ||
      !college ||
      !branch ||
      !year_of_study ||
      cgpa === undefined ||
      cgpa === null ||
      cgpa === ""
    ) {
      return NextResponse.json(
        { error: "All signup fields are required" },
        { status: 400 }
      );
    }

    // Validate CGPA
    const cgpaNumber = Number(cgpa);

    if (
      !Number.isFinite(cgpaNumber) ||
      cgpaNumber < 0 ||
      cgpaNumber > 10
    ) {
      return NextResponse.json(
        { error: "CGPA must be a number between 0 and 10" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Create the authentication account and attach profile metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name.trim(),
          college: college.trim(),
          branch,
          year_of_study,
          cgpa: cgpaNumber,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Signup request successful",
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
      emailConfirmationRequired: !data.session,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
