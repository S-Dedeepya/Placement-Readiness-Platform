
"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const tabClass =
  "h-11 flex-none rounded-none border-0 px-2 text-base font-medium text-zinc-200 hover:bg-transparent hover:text-white data-[active]:text-white after:bottom-[-1px] after:h-0.5 after:bg-white";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [college, setCollege] = useState("");
  const [branch, setBranch] = useState("");
  const [cgpa, setCgpa] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentSkills, setStudentSkills] = useState<any[]>([]);

const [availableSkills, setAvailableSkills] = useState<any[]>([]);
const [selectedSkillId, setSelectedSkillId] = useState("");
const [proficiency, setProficiency] = useState("5");
const [skillsLoading, setSkillsLoading] = useState(false);
const [skillsSaving, setSkillsSaving] = useState(false);
const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
const [editProficiency, setEditProficiency] = useState("5");

const [studentProjects, setStudentProjects] = useState<any[]>([]);
const [projectsLoading, setProjectsLoading] = useState(false);
const [projectsSaving, setProjectsSaving] = useState(false);
const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

const [projectTitle, setProjectTitle] = useState("");
const [projectDescription, setProjectDescription] = useState("");
const [projectTechStack, setProjectTechStack] = useState("");
const [projectGithubUrl, setProjectGithubUrl] = useState("");

const [editProjectTitle, setEditProjectTitle] = useState("");
const [editProjectDescription, setEditProjectDescription] = useState("");
const [editProjectTechStack, setEditProjectTechStack] = useState("");
const [editProjectGithubUrl, setEditProjectGithubUrl] = useState("");
const [studentCertifications, setStudentCertifications] = useState<any[]>([]);
const [certificationsLoading, setCertificationsLoading] = useState(false);
const [certificationsSaving, setCertificationsSaving] = useState(false);
const [editingCertificationId, setEditingCertificationId] = useState<number | null>(null);

const [certificationName, setCertificationName] = useState("");
const [certificationIssuer, setCertificationIssuer] = useState("");
const [certificationEarnedDate, setCertificationEarnedDate] = useState("");

const [editCertificationName, setEditCertificationName] = useState("");
const [editCertificationIssuer, setEditCertificationIssuer] = useState("");
const [editCertificationEarnedDate, setEditCertificationEarnedDate] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  async function loadProfile() {
  try {
    setLoading(true);

    const response = await fetch("/api/profile");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Failed to load profile");
    }

    const profile = result.profile;

    if (profile) {
      setName(profile.full_name ?? "");
      setYear(
        profile.year_of_study == null
          ? ""
          : String(profile.year_of_study)
      );
      setCollege(profile.college ?? "");
      setBranch(profile.branch ?? "");
      setCgpa(profile.cgpa == null ? "" : String(profile.cgpa));
      setEmail(profile.email ?? "");
    }
  } catch (error) {
    console.error("Profile loading error:", error);
    setMessage(
      error instanceof Error
        ? error.message
        : "Something went wrong while loading your profile."
    );
    setMessageType("error");
  } finally {
    setLoading(false);
  }
}
  
async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setMessage("");

  // Validate required fields
  if (!name.trim() || !year.trim() || !branch.trim()) {
    setMessage("Please fill in your name, year, and branch.");
    setMessageType("error");
    return;
  }

  const parsedCgpa = cgpa.trim() === "" ? null : Number(cgpa);

  if (
    parsedCgpa !== null &&
    (!Number.isFinite(parsedCgpa) ||
      parsedCgpa < 0 ||
      parsedCgpa > 10)
  ) {
    setMessage("CGPA must be between 0 and 10.");
    setMessageType("error");
    return;
  }

  setSaving(true);

  try {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: name.trim(),
        year_of_study: year.trim(),
        college: college.trim(),
        branch: branch.trim(),
        cgpa: parsedCgpa,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(
        result.error ?? "Could not save changes. Please try again."
      );
      setMessageType("error");
      return;
    }

    setMessage("Your profile has been updated successfully.");
    setMessageType("success");
  } catch {
    setMessage("Something went wrong. Please try again.");
    setMessageType("error");
  } finally {
    setSaving(false);
  }
}
useEffect(() => {
  loadProfile();
  loadStudentSkills();
  loadAvailableSkills();
  loadStudentProjects();
    loadStudentCertifications();
}, []);

async function loadStudentSkills() {
  try {
    const response = await fetch("/api/student-skills");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Could not load your skills.");
    }

    setStudentSkills(result.studentSkills ?? []);
  } catch (error) {
    console.error("Student skills loading error:", error);
    setMessage(
      error instanceof Error
        ? error.message
        : "Could not load your skills."
    );
    setMessageType("error");
  }
}
async function updateStudentSkill(skillId: string) {
  setMessage("");

  try {
    const response = await fetch("/api/student-skills", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        skill_id: skillId,
        proficiency: Number(editProficiency),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Could not update skill.");
    }

    await loadStudentSkills();
    setEditingSkillId(null);
    setMessage("Skill updated successfully!");
    setMessageType("success");
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Could not update skill."
    );
    setMessageType("error");
  }
}

async function deleteStudentSkill(skillId: string) {
  const confirmed = window.confirm(
    "Are you sure you want to remove this skill?"
  );

  if (!confirmed) return;

  setMessage("");

  try {
    const response = await fetch(
      `/api/student-skills?skill_id=${encodeURIComponent(skillId)}`,
      { method: "DELETE" }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Could not delete skill.");
    }

    await loadStudentSkills();
    setMessage("Skill removed successfully!");
    setMessageType("success");
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Could not delete skill."
    );
    setMessageType("error");
  }
}
async function loadAvailableSkills() {
  try {
    const response = await fetch("/api/skills");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Could not load available skills.");
    }

    setAvailableSkills(result.skills ?? []);
  } catch (error) {
    console.error("Available skills loading error:", error);
    setMessage(
      error instanceof Error
        ? error.message
        : "Could not load available skills."
    );
    setMessageType("error");
  }
}



const loadStudentProjects = async () => {
  setProjectsLoading(true);

  try {
    const response = await fetch("/api/student-projects");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Could not load projects.");
    }

    setStudentProjects(result.projects ?? []);
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Could not load projects."
    );
    setMessageType("error");
  } finally {
    setProjectsLoading(false);
  }
};
const loadStudentCertifications = async () => {
  setCertificationsLoading(true);

  try {
    const response = await fetch("/api/student-certifications");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to load certifications.");
    }

    setStudentCertifications(result.certifications ?? []);
  } catch (error) {
    console.error("Error loading certifications:", error);
  } finally {
    setCertificationsLoading(false);
  }
};


  return (
    <section className="py-3">
      <h2 className="text-3xl font-bold tracking-tight text-white">
        My Profile
      </h2>

      <p className="mt-3 text-zinc-400">
        Your journey, your skills, your future.
      </p>

      <hr className="mt-8 border-zinc-700" />

      <Tabs defaultValue="Academic Info" className="mt-6 w-full">
        <TabsList
          variant="line"
          className="h-auto w-fit justify-start gap-6 rounded-none bg-transparent p-0"
        >
          <TabsTrigger value="Academic Info" className={tabClass}>
            Academic Info
          </TabsTrigger>

          <TabsTrigger value="Skills" className={tabClass}>
            Skills
          </TabsTrigger>

          <TabsTrigger value="Projects" className={tabClass}>
            Projects
          </TabsTrigger>

          <TabsTrigger value="Certifications" className={tabClass}>
            Certifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="Academic Info" className="mt-6">
          <Card className="rounded-md border-zinc-700 bg-white text-slate-800 shadow-none">
            <CardHeader className="gap-1 pb-4">
              <CardTitle className="text-sm font-semibold">
                Academic Information
              </CardTitle>

              <CardDescription className="text-sm text-slate-600">
                Update your name, year, college, branch, and CGPA.
                Your email address is read-only.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {loading ? (
                <p className="text-sm text-slate-600">
                  Loading your profile...
                </p>
              ) : (
                <form onSubmit={saveProfile} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="border-slate-500 bg-slate-200"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        min="1"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        required
                        className="border-slate-500 bg-slate-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="branch">Branch</Label>
                      <Input
                        id="branch"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        required
                        className="border-slate-500 bg-slate-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="college">College</Label>
                      <Input
                        id="college"
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        required
                        className="border-slate-500 bg-slate-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cgpa">CGPA (out of 10)</Label>
                      <Input
                        id="cgpa"
                        type="number"
                        min="0"
                        max="10"
                        step="0.01"
                        value={cgpa}
                        onChange={(e) => setCgpa(e.target.value)}
                        className="border-slate-500 bg-slate-200"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="email" className="text-slate-600">
                        Email (read-only)
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        readOnly
                        className="border-slate-300 bg-slate-200 text-slate-500"
                      />
                    </div>
                  </div>

                  {message && (
                    <p
                      role="status"
                      className={`text-sm ${
                        messageType === "error"
                          ? "text-red-600"
                          : "text-green-700"
                      }`}
                    >
                      {message}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-sm bg-slate-900 text-white hover:bg-slate-800"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        

<TabsContent value="Skills" className="mt-6 space-y-6">
  {/* Add Skill */}
  <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <CardHeader>
      <CardTitle className="text-slate-900">Add a Skill</CardTitle>
      <CardDescription className="text-slate-500">
        Select a skill and rate your proficiency from 1 to 10.
      </CardDescription>
    </CardHeader>

    <CardContent>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage("");
          setMessageType("");
          setSkillsSaving(true);

          try {
            const response = await fetch("/api/student-skills", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                skill_id: selectedSkillId,
                proficiency: Number(proficiency),
              }),
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(result.error ?? "Could not add skill.");
            }

            await loadStudentSkills();
            setSelectedSkillId("");
            setProficiency("5");
            setMessage("Skill added successfully!");
            setMessageType("success");
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Could not add skill."
            );
            setMessageType("error");
          } finally {
            setSkillsSaving(false);
          }
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="skill" className="text-slate-700">
            Select Skill
          </Label>

          <select
            id="skill"
            value={selectedSkillId}
            onChange={(e) => setSelectedSkillId(e.target.value)}
            required
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">Choose a skill</option>

            {availableSkills
              .filter(
                (skill) =>
                  !studentSkills.some(
                    (item) => item.skill_id === skill.id
                  )
              )
              .map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.skill_name}
                  {skill.category ? ` — ${skill.category}` : ""}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-3">
          <Label className="text-slate-700">
            Proficiency: {proficiency}/10
          </Label>

          <input
            type="range"
            min="1"
            max="10"
            value={proficiency}
            onChange={(e) => setProficiency(e.target.value)}
            className="w-full accent-slate-900"
          />

          <div className="flex justify-between text-xs text-slate-500">
            <span>Beginner (1)</span>
            <span>Expert (10)</span>
          </div>
        </div>

        <Button
          type="submit"
          disabled={skillsSaving || !selectedSkillId}
          className="bg-slate-900 text-white hover:bg-slate-800"
        >
          {skillsSaving ? "Adding..." : "Add Skill"}
        </Button>
      </form>
    </CardContent>
  </Card>

  {/* My Skills */}
  <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <CardHeader>
      <CardTitle className="text-slate-900">My Skills</CardTitle>
      <CardDescription className="text-slate-500">
        View, update, or remove your skills.
      </CardDescription>
    </CardHeader>

    <CardContent className="space-y-4">
      {message && (
        <p
          role="status"
          className={`text-sm ${
            messageType === "error"
              ? "text-red-600"
              : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}

      {skillsLoading ? (
        <p className="text-sm text-slate-500">
          Loading your skills...
        </p>
      ) : studentSkills.length === 0 ? (
        <p className="text-sm text-slate-500">
          No skills added yet. Add your first skill above.
        </p>
      ) : (
        studentSkills.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-slate-900">
                {item.skills?.skill_name ?? "Unknown skill"}
              </h3>

              <p className="text-sm text-slate-500">
                {item.skills?.category ?? "Skill"}
              </p>

              {editingSkillId === item.skill_id ? (
                <div className="mt-3 space-y-3">
                  <Label className="text-slate-700">
                    Proficiency: {editProficiency}/10
                  </Label>

                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={editProficiency}
                    onChange={(e) =>
                      setEditProficiency(e.target.value)
                    }
                    className="w-full accent-slate-900"
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => updateStudentSkill(item.skill_id)}
                      className="bg-slate-900 text-white hover:bg-slate-800"
                    >
                      Save
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingSkillId(null);
                        setEditProficiency(String(item.proficiency));
                      }}
                      className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">
                      Proficiency
                    </span>
                    <span className="text-slate-900">
                      {item.proficiency}/10
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{
                        width: `${item.proficiency * 10}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {editingSkillId !== item.skill_id && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingSkillId(item.skill_id);
                    setEditProficiency(String(item.proficiency));
                  }}
                  className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                >
                  Edit
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => deleteStudentSkill(item.skill_id)}
                  className="border-slate-300 bg-white text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </CardContent>
  </Card>
</TabsContent>


        

<TabsContent value="Projects" className="mt-6 space-y-6">
  {/* Add Project */}
  <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <CardHeader>
      <CardTitle className="text-slate-900">Add a Project</CardTitle>
      <CardDescription className="text-slate-500">
        Showcase your projects and the technologies you have used.
      </CardDescription>
    </CardHeader>

    <CardContent>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage("");
          setMessageType("");
          setProjectsSaving(true);

          try {
            const response = await fetch("/api/student-projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                project_name: projectTitle.trim(),
                description: projectDescription.trim(),
                tech_stack: projectTechStack
                  .split(",")
                  .map((tech) => tech.trim())
                  .filter(Boolean),
                repository_url: projectGithubUrl.trim() || null,
              }),
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(result.error ?? "Could not add project.");
            }

            await loadStudentProjects();
            setProjectTitle("");
            setProjectDescription("");
            setProjectTechStack("");
            setProjectGithubUrl("");
            setMessage("Project added successfully!");
            setMessageType("success");
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Could not add project."
            );
            setMessageType("error");
          } finally {
            setProjectsSaving(false);
          }
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="projectTitle" className="text-slate-700">
            Project Title
          </Label>
          <Input
            id="projectTitle"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="e.g. Placement Readiness Platform"
            required
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectDescription" className="text-slate-700">
            Description
          </Label>
          <textarea
            id="projectDescription"
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            placeholder="Describe what your project does..."
            required
            rows={4}
            className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectTechStack" className="text-slate-700">
            Tech Stack
          </Label>
          <Input
            id="projectTechStack"
            value={projectTechStack}
            onChange={(e) => setProjectTechStack(e.target.value)}
            placeholder="e.g. Next.js, TypeScript, Supabase"
            required
            className="border-slate-300 bg-white text-slate-900"
          />
          <p className="text-xs text-slate-500">
            Separate technologies with commas.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectGithubUrl" className="text-slate-700">
            GitHub URL
          </Label>
          <Input
            id="projectGithubUrl"
            type="url"
            value={projectGithubUrl}
            onChange={(e) => setProjectGithubUrl(e.target.value)}
            placeholder="https://github.com/username/repository"
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>

        <Button
          type="submit"
          disabled={
            projectsSaving ||
            !projectTitle.trim() ||
            !projectDescription.trim() ||
            !projectTechStack.trim()
          }
          className="bg-slate-900 text-white hover:bg-slate-800"
        >
          {projectsSaving ? "Adding..." : "Add Project"}
        </Button>
      </form>
    </CardContent>
  </Card>

  {/* Project List */}
  <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <CardHeader>
      <CardTitle className="text-slate-900">My Projects</CardTitle>
      <CardDescription className="text-slate-500">
        View, update, or remove your saved projects.
      </CardDescription>
    </CardHeader>

    <CardContent className="space-y-4">
      {message && (
        <p
          role="status"
          className={`text-sm ${
            messageType === "error" ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}

      {projectsLoading ? (
        <p className="text-sm text-slate-500">Loading your projects...</p>
      ) : studentProjects.length === 0 ? (
        <p className="text-sm text-slate-500">
          No projects added yet. Add your first project above.
        </p>
      ) : (
        studentProjects.map((project) => {
          const isEditing = editingProjectId === project.id;

          return (
            <div
              key={project.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              {isEditing ? (
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setMessage("");
                    setMessageType("");
                    setProjectsSaving(true);

                    try {
                      const response = await fetch("/api/student-projects", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id: project.id,
                          project_name: editProjectTitle.trim(),
                          description: editProjectDescription.trim(),
                          tech_stack: editProjectTechStack
                            .split(",")
                            .map((tech) => tech.trim())
                            .filter(Boolean),
                          repository_url: editProjectGithubUrl.trim() || null,
                        }),
                      });

                      const result = await response.json();

                      if (!response.ok) {
                        throw new Error(
                          result.error ?? "Could not update project."
                        );
                      }

                      await loadStudentProjects();
                      setEditingProjectId(null);
                      setMessage("Project updated successfully!");
                      setMessageType("success");
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Could not update project."
                      );
                      setMessageType("error");
                    } finally {
                      setProjectsSaving(false);
                    }
                  }}
                >
                  <div className="space-y-2">
                    <Label className="text-slate-700">Project Title</Label>
                    <Input
                      value={editProjectTitle}
                      onChange={(e) => setEditProjectTitle(e.target.value)}
                      required
                      className="border-slate-300 text-slate-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700">Description</Label>
                    <textarea
                      value={editProjectDescription}
                      onChange={(e) =>
                        setEditProjectDescription(e.target.value)
                      }
                      required
                      rows={4}
                      className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700">Tech Stack</Label>
                    <Input
                      value={editProjectTechStack}
                      onChange={(e) =>
                        setEditProjectTechStack(e.target.value)
                      }
                      required
                      placeholder="React, Node.js, PostgreSQL"
                      className="border-slate-300 text-slate-900"
                    />
                    <p className="text-xs text-slate-500">
                      Separate technologies with commas.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700">GitHub URL</Label>
                    <Input
                      type="url"
                      value={editProjectGithubUrl}
                      onChange={(e) =>
                        setEditProjectGithubUrl(e.target.value)
                      }
                      placeholder="https://github.com/username/repository"
                      className="border-slate-300 text-slate-900"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="submit"
                      disabled={
                        projectsSaving ||
                        !editProjectTitle.trim() ||
                        !editProjectDescription.trim() ||
                        !editProjectTechStack.trim()
                      }
                      className="bg-slate-900 text-white hover:bg-slate-800"
                    >
                      {projectsSaving ? "Saving..." : "Save Changes"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={projectsSaving}
                      onClick={() => setEditingProjectId(null)}
                      className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900">
                        {project.project_name}
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                        {project.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingProjectId(project.id);
                          setEditProjectTitle(project.project_name ?? "");
                          setEditProjectDescription(project.description ?? "");
                          setEditProjectTechStack(
                            Array.isArray(project.tech_stack)
                              ? project.tech_stack.join(", ")
                              : typeof project.tech_stack === "string"
                                ? project.tech_stack
                                : ""
                          );
                          setEditProjectGithubUrl(project.repository_url ?? "");
                          setMessage("");
                        }}
                        className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={projectsSaving}
                        onClick={async () => {
                          if (!window.confirm("Delete this project?")) return;

                          setProjectsSaving(true);
                          setMessage("");
                          setMessageType("");

                          try {
                            const response = await fetch(
                              `/api/student-projects?id=${encodeURIComponent(
                                String(project.id)
                              )}`,
                              { method: "DELETE" }
                            );

                            const result = await response.json();

                            if (!response.ok) {
                              throw new Error(
                                result.error ?? "Could not delete project."
                              );
                            }

                            await loadStudentProjects();
                            setMessage("Project deleted successfully!");
                            setMessageType("success");
                          } catch (error) {
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : "Could not delete project."
                            );
                            setMessageType("error");
                          } finally {
                            setProjectsSaving(false);
                          }
                        }}
                        className="border-slate-300 bg-white text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      Tech Stack
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(project.tech_stack)
                        ? project.tech_stack
                        : typeof project.tech_stack === "string"
                          ? project.tech_stack
                              .split(",")
                              .map((tech: string) => tech.trim())
                          : []
                      ).map((tech: string, index: number) => (
                        <span
                          key={`${tech}-${index}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {project.repository_url && (
                    <a
                      href={project.repository_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950"
                    >
                      View GitHub Repository
                    </a>
                  )}
                </>
              )}
            </div>
          );
        })
      )}
    </CardContent>
  </Card>
</TabsContent>

       

<TabsContent value="Certifications" className="mt-6">
  <Card className="border border-slate-200 bg-white shadow-sm">
    <CardHeader>
      <CardTitle className="text-xl font-semibold text-slate-900">
        My Certifications
      </CardTitle>
      <CardDescription className="text-slate-500">
        Add your certifications and keep your achievements up to date.
      </CardDescription>
    </CardHeader>

    <CardContent className="space-y-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();

          if (!certificationName.trim() || !certificationIssuer.trim()) {
            setMessage("Certification name and issuer are required.");
            setMessageType("error");
            return;
          }

          setCertificationsSaving(true);
          setMessage("");

          try {
            const response = await fetch("/api/student-certifications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                certification_name: certificationName.trim(),
                issuer: certificationIssuer.trim(),
                earned_date: certificationEarnedDate || null,
              }),
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(
                result.error || "Failed to add certification."
              );
            }

            setCertificationName("");
            setCertificationIssuer("");
            setCertificationEarnedDate("");

            await loadStudentCertifications();

            setMessage("Certification added successfully.");
            setMessageType("success");
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Failed to add certification."
            );
            setMessageType("error");
          } finally {
            setCertificationsSaving(false);
          }
        }}
        className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
      >
        <h3 className="font-medium text-slate-900">
          Add a certification
        </h3>

        <div className="space-y-2">
          <Label htmlFor="certificationName" className="text-slate-700">
            Certification name *
          </Label>
          <Input
            id="certificationName"
            value={certificationName}
            onChange={(e) => setCertificationName(e.target.value)}
            placeholder="e.g. AWS Cloud Practitioner"
            required
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="certificationIssuer" className="text-slate-700">
            Issuing organization *
          </Label>
          <Input
            id="certificationIssuer"
            value={certificationIssuer}
            onChange={(e) => setCertificationIssuer(e.target.value)}
            placeholder="e.g. Amazon Web Services"
            required
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="certificationEarnedDate" className="text-slate-700">
            Date earned
          </Label>
          <Input
            id="certificationEarnedDate"
            type="date"
            value={certificationEarnedDate}
            onChange={(e) => setCertificationEarnedDate(e.target.value)}
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>

        <Button
          type="submit"
          disabled={certificationsSaving}
          className="bg-slate-900 text-white hover:bg-slate-800"
        >
          {certificationsSaving ? "Adding..." : "Add Certification"}
        </Button>
      </form>

      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">
          Your certifications
        </h3>

        {certificationsLoading ? (
          <p className="text-sm text-slate-500">
            Loading certifications...
          </p>
        ) : studentCertifications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm text-slate-600">
              No certifications added yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Add a certification using the form above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {studentCertifications.map((certification) => (
              <div
                key={certification.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                {editingCertificationId === certification.id ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();

                      if (
                        !editCertificationName.trim() ||
                        !editCertificationIssuer.trim()
                      ) {
                        setMessage(
                          "Certification name and issuer are required."
                        );
                        setMessageType("error");
                        return;
                      }

                      setCertificationsSaving(true);
                      setMessage("");

                      try {
                        const response = await fetch(
                          "/api/student-certifications",
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              id: certification.id,
                              certification_name:
                                editCertificationName.trim(),
                              issuer: editCertificationIssuer.trim(),
                              earned_date:
                                editCertificationEarnedDate || null,
                            }),
                          }
                        );

                        const result = await response.json();

                        if (!response.ok) {
                          throw new Error(
                            result.error || "Failed to update certification."
                          );
                        }

                        setEditingCertificationId(null);
                        await loadStudentCertifications();

                        setMessage("Certification updated successfully.");
                        setMessageType("success");
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : "Failed to update certification."
                        );
                        setMessageType("error");
                      } finally {
                        setCertificationsSaving(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label className="text-slate-700">
                        Certification name *
                      </Label>
                      <Input
                        value={editCertificationName}
                        onChange={(e) =>
                          setEditCertificationName(e.target.value)
                        }
                        required
                        className="border-slate-300 bg-white text-slate-900"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-700">
                        Issuing organization *
                      </Label>
                      <Input
                        value={editCertificationIssuer}
                        onChange={(e) =>
                          setEditCertificationIssuer(e.target.value)
                        }
                        required
                        className="border-slate-300 bg-white text-slate-900"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-700">
                        Date earned
                      </Label>
                      <Input
                        type="date"
                        value={editCertificationEarnedDate}
                        onChange={(e) =>
                          setEditCertificationEarnedDate(e.target.value)
                        }
                        className="border-slate-300 bg-white text-slate-900"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        disabled={certificationsSaving}
                        className="bg-slate-900 text-white hover:bg-slate-800"
                      >
                        {certificationsSaving ? "Saving..." : "Save Changes"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={certificationsSaving}
                        onClick={() => setEditingCertificationId(null)}
                        className="border-slate-300 text-slate-700"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0 space-y-1">
                      <h4 className="font-semibold text-slate-900">
                        {certification.certification_name}
                      </h4>

                      <p className="text-sm text-slate-600">
                        Issued by {certification.issuer}
                      </p>

                      <p className="text-xs text-slate-500">
                        {certification.earned_date
                          ? `Earned on ${certification.earned_date}`
                          : "Date not provided"}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-slate-300 text-slate-700"
                        onClick={() => {
                          setEditingCertificationId(certification.id);
                          setEditCertificationName(
                            certification.certification_name
                          );
                          setEditCertificationIssuer(certification.issuer);
                          setEditCertificationEarnedDate(
                            certification.earned_date || ""
                          );
                          setMessage("");
                        }}
                      >
                        Edit
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        onClick={async () => {
                          const confirmed = window.confirm(
                            "Are you sure you want to delete this certification?"
                          );

                          if (!confirmed) return;

                          setCertificationsSaving(true);
                          setMessage("");

                          try {
                            const response = await fetch(
                              `/api/student-certifications?id=${certification.id}`,
                              { method: "DELETE" }
                            );

                            const result = await response.json();

                            if (!response.ok) {
                              throw new Error(
                                result.error || "Failed to delete certification."
                              );
                            }

                            await loadStudentCertifications();

                            setMessage("Certification deleted successfully.");
                            setMessageType("success");
                          } catch (error) {
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : "Failed to delete certification."
                            );
                            setMessageType("error");
                          } finally {
                            setCertificationsSaving(false);
                          }
                        }}
                        disabled={certificationsSaving}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </CardContent>
  </Card>
</TabsContent>


      </Tabs>
    </section>
  );
}