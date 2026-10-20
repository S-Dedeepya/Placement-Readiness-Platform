
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
//if the user is trying to login with entering anything
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }
//creates connection 
    const supabase = await createClient();
//send the entered email and password... and error like object where if both unmatched then error object returned else null.
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });
//error object return means both email and password are unmatched so this condition works 
    if (error) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }
//if everything is fine then this 
    return NextResponse.json({
      message: "Login successful",
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
