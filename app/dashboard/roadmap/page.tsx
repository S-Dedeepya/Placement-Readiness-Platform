"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type JobRole = {
  id: string;
  title: string;
  domain?: string;
  level?: string;
  description?: string;
};

type CareerFocusArea = {
  rank: number;
  skill_id: string;
  skill_name: string;
  importance: string;
  evidence_level: string;
  readiness_gain: number;
  explanation: string;
};

type CareerStrength = {
  skill_id: string;
  skill_name: string;
  evidence_level: string;
  note: string;
};

type CareerRoleFit = {
  role_id: string;
  title: string;
  fit: number;
};

type CareerReport = {
  summary: string[];
  closing: string;
  readiness: { score: number; label: string };
  focus_areas: CareerFocusArea[];
  strengths: CareerStrength[];
  other_roles: CareerRoleFit[];
  method: string;
};

type ApiError = {
  detail?: string;
  message?: string;
};

const ML_SERVICE_URL = (process.env.NEXT_PUBLIC_ML_SERVICE_URL || "http://127.0.0.1:8001").replace(/\/$/, "");

function normalizeRoles(data: any): JobRole[] {
  const roles = Array.isArray(data)
    ? data
    : data?.jobRoles ?? data?.roles ?? data?.data?.jobRoles ?? data?.data?.roles ?? [];

  return roles
    .filter((role: any) => role?.id && role?.title)
    .map((role: any) => ({
      id: String(role.id),
      title: String(role.title).trim(),
      domain: role.domain ?? "",
      level: role.level ?? "",
      description: role.description ?? "",
    }));
}

export default function RoadmapPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [careerReport, setCareerReport] = useState<CareerReport | null>(null);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [reportError, setReportError] = useState("");

  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    setRoleError("");
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/job-roles", {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const errorData = data as ApiError;
        throw new Error(errorData.detail || errorData.message || "Unable to load job roles.");
      }

      const availableRoles = normalizeRoles(data);
      setRoles(availableRoles);
      setSelectedRoleId((current) =>
        current && availableRoles.some((role) => role.id === current)
          ? current
          : availableRoles[0]?.id ?? ""
      );
      if (availableRoles.length === 0) setRoleError("No job roles are currently available.");
    } catch (error) {
      console.error("Failed to load job roles:", error);
      setRoleError(error instanceof Error ? error.message : "Unable to load job roles.");
    } finally {
      setLoadingRoles(false);
    }
  }, [router]);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  useEffect(() => {
    if (!selectedRoleId) {
      setCareerReport(null);
      setReportError("");
      setLoadingReport(false);
      return;
    }

    let cancelled = false;
    async function loadReport() {
      setLoadingReport(true);
      setReportError("");
      setCareerReport(null);
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError) throw authError;
        if (!session) {
          router.push("/login");
          return;
        }

        const response = await fetch(`${ML_SERVICE_URL}/career-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ role_id: selectedRoleId }),
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          const errorData = data as ApiError;
          throw new Error(errorData.detail || errorData.message || "Unable to generate your report.");
        }

        const report: CareerReport | null = data.career_report ?? null;
        if (!report) throw new Error("Your career report could not be generated. Please try again.");

        if (!cancelled) setCareerReport(report);
      } catch (error) {
        console.error("Failed to generate career report:", error);
        if (!cancelled) setReportError(error instanceof Error ? error.message : "Unable to generate your report.");
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    }

    void loadReport();
    return () => { cancelled = true; };
  }, [selectedRoleId, router]);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <section className="mb-10">
          <label htmlFor="target-role" className="block text-lg font-semibold">
            Select Target Role
          </label>
          <p className="mt-2 text-sm text-zinc-400">
            Choose a role to view learning recommendations tailored to your profile.
          </p>
          <select
            id="target-role"
            value={selectedRoleId}
            onChange={(event) => setSelectedRoleId(event.target.value)}
            disabled={loadingRoles || roles.length === 0}
            className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-60"
          >
            <option value="">{loadingRoles ? "Loading roles..." : "Choose a job role"}</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}
          </select>
          {roleError && <p className="mt-3 text-sm text-red-400">{roleError}</p>}
        </section>

        <article className="space-y-7 text-[15px] leading-7 text-zinc-300">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Your Personalized Learning Roadmap
            </h1>
            {selectedRole && (
              <p className="mt-2 text-sm text-zinc-400">
                A practical learning report for your goal of becoming a {selectedRole.title}.
              </p>
            )}
            {selectedRole?.description && <p className="mt-3">{selectedRole.description}</p>}
          </header>

          {!selectedRoleId && !loadingRoles && (
            <p>Select a target role above to generate your personalized learning report.</p>
          )}
          {loadingReport && <p className="text-zinc-400">Reviewing your profile against the selected role...</p>}
          {reportError && !loadingReport && <p className="text-red-400">{reportError}</p>}

          {!loadingReport && !reportError && careerReport && (
            <>
              <section>
                <h2 className="mb-3 text-lg font-semibold text-white">Where You Stand</h2>
                <div className="mb-5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-white">{careerReport.readiness.label}</span>
                    <span className="text-zinc-400">
                      {careerReport.readiness.score}% of the role requirements met
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${Math.min(100, Math.max(0, careerReport.readiness.score))}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  {careerReport.summary.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </section>

              {careerReport.focus_areas.length > 0 && (
                <section>
                  <h2 className="mb-3 text-lg font-semibold text-white">What to Focus On and Why</h2>
                  <div className="space-y-7">
                    {careerReport.focus_areas.map((area) => (
                      <section key={area.skill_id} className="border-l-2 border-violet-500/70 pl-4">
                        <h3 className="text-base font-semibold text-white">
                          {area.rank}. {area.skill_name}
                        </h3>
                        <p className="mt-2">{area.explanation}</p>
                      </section>
                    ))}
                  </div>
                </section>
              )}

              {careerReport.strengths.length > 0 && (
                <section>
                  <h2 className="mb-3 text-lg font-semibold text-white">Your Strengths for This Role</h2>
                  <ul className="list-disc space-y-2 pl-6">
                    {careerReport.strengths.map((strength) => (
                      <li key={strength.skill_id}>
                        <span className="font-medium text-white">{strength.skill_name}</span>
                        <span className="text-zinc-400"> - {strength.note}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {careerReport.other_roles.length > 0 && (
                <section>
                  <h2 className="mb-3 text-lg font-semibold text-white">Other Roles You Are Close To</h2>
                  <ul className="list-disc space-y-2 pl-6">
                    {careerReport.other_roles.map((otherRole) => (
                      <li key={otherRole.role_id}>
                        <span className="font-medium text-white">{otherRole.title}</span>
                        <span className="text-zinc-400"> - {otherRole.fit}% of requirements met</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {careerReport.closing && (
                <section>
                  <h2 className="mb-3 text-lg font-semibold text-white">Your Next Step</h2>
                  <p>{careerReport.closing}</p>
                </section>
              )}

              <p className="border-t border-zinc-800 pt-4 text-sm text-zinc-500">{careerReport.method}</p>
            </>
          )}
        </article>
      </div>
    </main>
  );
}
