
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
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
  const roleId = searchParams.get("roleId");

  if (!roleId) {
    return NextResponse.json(
      { error: "Please provide a roleId query parameter." },
      { status: 400 }
    );
  }

  const { data: role, error: roleError } = await supabase
    .from("job_roles")
    .select("id, title, domain, level, description")
    .eq("id", roleId)
    .maybeSingle();

  if (roleError) {
    return NextResponse.json(
      { error: "Could not retrieve the selected role." },
      { status: 500 }
    );
  }

  if (!role) {
    return NextResponse.json(
      { error: "Job role not found." },
      { status: 404 }
    );
  }

  const { data: requirements, error: requirementsError } =
    await supabase
      .from("role_skill_requirements")
      .select(`
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
      .eq("role_id", roleId);

  if (requirementsError) {
    return NextResponse.json(
      { error: "Could not retrieve role skill requirements." },
      { status: 500 }
    );
  }

  const { data: studentSkills, error: studentSkillsError } =
    await supabase
      .from("student_skills")
      .select("skill_id, proficiency")
      .eq("student_id", user.id);

  if (studentSkillsError) {
    return NextResponse.json(
      { error: "Could not retrieve your skills." },
      { status: 500 }
    );
  }

  const studentSkillMap = new Map(
    (studentSkills ?? []).map((skill) => [
      skill.skill_id,
      skill.proficiency,
    ])
  );

  const skillGaps = (requirements ?? []).map((requirement) => {
    const currentProficiency =
      studentSkillMap.get(requirement.skill_id) ?? 0;

    const requiredProficiency = requirement.required_proficiency;

    return {
      skill: requirement.skills,
      skill_id: requirement.skill_id,
      required_proficiency: requiredProficiency,
      current_proficiency: currentProficiency,
      gap: Math.max(0, requiredProficiency - currentProficiency),
      importance: requirement.importance,
      is_missing: currentProficiency === 0,
      is_proficient: currentProficiency >= requiredProficiency,
    };
  });

  const missingSkills = skillGaps.filter((item) => item.is_missing);
  const skillsToImprove = skillGaps.filter(
    (item) => !item.is_missing && !item.is_proficient
  );
  const masteredSkills = skillGaps.filter((item) => item.is_proficient);

  return NextResponse.json(
    {
      role,
      summary: {
        total_required_skills: skillGaps.length,
        missing_skills: missingSkills.length,
        skills_to_improve: skillsToImprove.length,
        proficient_skills: masteredSkills.length,
      },
      skill_gaps: skillGaps,
    },
    { status: 200 }
  );
}
