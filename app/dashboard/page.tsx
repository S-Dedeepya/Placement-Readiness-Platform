
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

type JobRole = {
  id: string;
  title: string;
  domain: string | null;
  level: string | null;
  description: string | null;
};

type Skill = {
  id: string;
  type: string | null;
  category: string | null;
  skill_name: string;
  description: string | null;
};

type SkillGap = {
  skill_id: string;
  skill: Skill;
  required_proficiency: number;
  current_proficiency: number;
  gap: number;
  is_missing: boolean;
  is_proficient: boolean;
  importance?: number;
};

export default function DashboardPage() {
  const router = useRouter();

  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  const [roles, setRoles] = useState<JobRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState("");

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleSearch, setRoleSearch] = useState("");

  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
  const [skillGapLoading, setSkillGapLoading] = useState(false);
  const [skillGapError, setSkillGapError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          router.replace("/");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        const name =
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          "Student";

        setUserName(name);
      } catch (error) {
        console.error("Could not load user:", error);
        router.replace("/");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    async function loadRoles() {
      try {
        setRolesError("");

        const response = await fetch("/api/job-roles");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Could not load job roles."
          );
        }

        if (!cancelled) {
          setRoles(
            Array.isArray(result.jobRoles) ? result.jobRoles : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setRolesError(
            error instanceof Error
              ? error.message
              : "Could not load job roles."
          );
        }
      } finally {
        if (!cancelled) {
          setRolesLoading(false);
        }
      }
    }

    loadUser();
    loadRoles();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!selectedRoleId) {
      setSkillGaps([]);
      setSkillGapError("");
      setSkillGapLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSkillGap() {
      try {
        setSkillGapLoading(true);
        setSkillGapError("");

        const response = await fetch(
          `/api/skill-gap?roleId=${encodeURIComponent(selectedRoleId)}`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Could not load skill-gap data."
          );
        }

        if (!cancelled) {
          setSkillGaps(
            Array.isArray(result.skill_gaps)
              ? result.skill_gaps
              : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setSkillGapError(
            error instanceof Error
              ? error.message
              : "Could not load skill-gap data."
          );
        }
      } finally {
        if (!cancelled) {
          setSkillGapLoading(false);
        }
      }
    }

    loadSkillGap();

    return () => {
      cancelled = true;
    };
  }, [selectedRoleId]);

  // Detect whether the student has any skills in their profile.
  // The API marks skills that are absent from the student's profile
  // with is_missing = true.
  const hasNoSkills =
    skillGaps.length > 0 &&
    skillGaps.every((item) => item.is_missing);

  return (
    <section className="py-6">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {loading ? "Welcome..." : `Welcome, ${userName.toUpperCase()}!`}
      </h2>

      <p className="mt-3 text-zinc-400">
        Welcome to your Placement Readiness Platform.
        Let&apos;s get ready for your dream placement!
      </p>

      <hr className="mt-10 border-zinc-700" />

      <h4 className="mt-5 text-4xl font-bold tracking-tight sm:text-3xl">
        What role are you targeting?
      </h4>

      <p className="mt-3 text-zinc-400">
        Choose your desired career path to personalize your placement
        preparation.
      </p>

      <div className="mt-5">
        {rolesLoading ? (
          <p className="text-sm text-zinc-400">
            Loading job roles...
          </p>
        ) : rolesError ? (
          <p className="text-sm text-red-500">{rolesError}</p>
        ) : roles.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No job roles are available yet.
          </p>
        ) : (
          <Combobox
            items={roles.map((role) => ({
              value: role.id,
              label: role.title.trim(),
            }))}
            value={selectedRoleId}
            onValueChange={(value) => {
              const id = typeof value === "string" ? value : "";

              setSelectedRoleId(id);

              const selectedRole = roles.find(
                (role) => role.id === id
              );

              setRoleSearch(selectedRole?.title.trim() ?? "");
            }}
          >
            <ComboboxInput
              placeholder="Select Target Role"
              value={roleSearch}
              onChange={(event) => setRoleSearch(event.target.value)}
            />

            <ComboboxContent>
              <ComboboxEmpty>No matching roles found.</ComboboxEmpty>

              <ComboboxList>
                {(item) => (
                  <ComboboxItem
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        )}
      </div>

      {/* Skill Gap Section */}
      <div className="mt-8">
        {selectedRoleId && skillGapLoading ? (
          <p className="text-sm text-zinc-400">
            Loading skill-gap analysis...
          </p>
        ) : skillGapError ? (
          <p className="text-sm text-red-500">{skillGapError}</p>
        ) : selectedRoleId && skillGaps.length === 0 ? (
          <div className="rounded-lg border border-zinc-700 p-5">
            <h3 className="text-lg font-semibold">Your Skill Gap</h3>

            <p className="mt-2 text-sm text-zinc-400">
              No skill-gap data is available for this role yet.
            </p>
          </div>
        ) : selectedRoleId ? (
          <div className="rounded-lg border border-zinc-700 p-5">
            <h3 className="text-xl font-semibold">Your Skill Gap</h3>

            <p className="mt-2 text-sm text-zinc-400">
              Compare your current proficiency with the requirements
              for your target role.
            </p>

            {hasNoSkills && (
              <div className="mt-5 rounded-lg border border-zinc-700 p-4">
                <h4 className="font-semibold">
                  Build your skill profile
                </h4>

                <p className="mt-2 text-sm text-zinc-400">
                  You haven&apos;t added any skills to your profile yet.
                  Add your skills and proficiency levels to get a more
                  personalized skill-gap analysis.
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/profile")}
                  className="mt-4 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
                >
                  Go to My Profile
                </button>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {skillGaps.map((item) => (
                <div
                  key={item.skill_id}
                  className="flex flex-col gap-2 rounded-md border border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {item.skill.skill_name}
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      Your level: {item.current_proficiency}/10
                      {" · "}
                      Required: {item.required_proficiency}/10
                    </p>
                  </div>

                  <span
                    className={`text-sm font-medium ${
                      item.is_proficient
                        ? "text-green-500"
                        : "text-amber-500"
                    }`}
                  >
                    {item.is_proficient
                      ? "Requirement met"
                      : item.is_missing
                        ? "Not added"
                        : `Gap: ${item.gap}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
