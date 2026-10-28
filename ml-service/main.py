
import logging
import re
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import numpy as np
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

from auth import get_current_user
from career_report import build_career_report
from database import get_supabase_client


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Placement Readiness API",
    description="Personalized placement-readiness learning roadmaps.",
    version="1.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RoadmapRequest(BaseModel):
    role_id: str = Field(..., min_length=1)


class TaskProgressRequest(BaseModel):
    role_id: str = Field(..., min_length=1)
    task_key: str = Field(..., min_length=1)
    status: str


VALID_STATUSES = {"not_started", "in_progress", "completed"}

PHASES = [
    ("learn", "Learn", 2),
    ("practise", "Practise", 3),
    ("build", "Build", 4),
    ("verify", "Verify", 1),
]

IMPORTANCE_RANK = {
    "high": 0,
    "medium": 1,
    "low": 2,
    "existing": 3,
}

# Initial similarity cutoff. Validate this against real student evidence.
SEMANTIC_SIMILARITY_THRESHOLD = 0.25


# ---------------------------------------------------------------------
# Semantic matching
# ---------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """Load the embedding model once and reuse it."""
    logger.info("Loading sentence-transformer embedding model.")

    return SentenceTransformer(
        "sentence-transformers/all-MiniLM-L6-v2"
    )


def find_related_evidence(
    skill_name: str,
    evidence: list[dict],
    limit: int = 3,
) -> list[dict]:
    """
    Rank student evidence by semantic similarity to a required skill.

    Returns the same fields expected by the existing roadmap:
    type, title, similarity.
    """
    if not skill_name or not evidence or limit <= 0:
        return []

    usable_evidence = []
    evidence_texts = []

    for item in evidence:
        description = normalize_text(item.get("description")).strip()

        if description:
            usable_evidence.append(item)
            evidence_texts.append(description)

    if not evidence_texts:
        return []

    try:
        model = get_embedding_model()

        embeddings = model.encode(
            [skill_name] + evidence_texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )

        skill_embedding = embeddings[0]
        evidence_embeddings = embeddings[1:]

        # Since vectors are normalized, their dot product is cosine similarity.
        scores = evidence_embeddings @ skill_embedding

    except Exception:
        logger.exception("Semantic evidence matching failed")
        return []

    ranked_indices = sorted(
        range(len(scores)),
        key=lambda index: float(scores[index]),
        reverse=True,
    )

    matches = []

    for index in ranked_indices:
        score = float(scores[index])

        if not np.isfinite(score):
            continue

        if score < SEMANTIC_SIMILARITY_THRESHOLD:
            continue

        item = usable_evidence[index]

        matches.append({
            "type": item.get("type", "evidence"),
            "title": item.get("title") or "Student evidence",
            "similarity": round(score, 3),
        })

        if len(matches) >= limit:
            break

    return matches


# ---------------------------------------------------------------------
# General helpers
# ---------------------------------------------------------------------

def rows_from(response: Any) -> list[dict]:
    if response is None:
        return []

    data = getattr(response, "data", None)
    return data if isinstance(data, list) else []


def get_student_id(current_user: dict) -> str:
    student_id = current_user.get("user_id")

    if not student_id:
        raise HTTPException(
            status_code=401,
            detail="Unable to identify the authenticated student.",
        )

    return str(student_id)


def fetch_one_or_404(
    supabase,
    table,
    column,
    value,
    message,
):
    response = (
        supabase.table(table)
        .select("*")
        .eq(column, value)
        .limit(1)
        .execute()
    )

    records = rows_from(response)

    if not records:
        raise HTTPException(status_code=404, detail=message)

    return records[0]


def normalize_text(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, list):
        return " ".join(str(item) for item in value)

    if isinstance(value, dict):
        return " ".join(
            f"{key} {item}" for key, item in value.items()
        )

    return str(value)


def make_task_key(
    role_id: str,
    skill_id: str,
    task_type: str,
) -> str:
    # Preserve the existing saved-progress task-key convention.
    return f"{role_id}:{skill_id}:{task_type}"


def normalize_task_key(task_key: str) -> str:
    key = task_key.strip()

    match = re.fullmatch(
        r"(.+):(learn|practise|build|verify)(?:-\d+)?",
        key,
        flags=re.IGNORECASE,
    )

    if match:
        return f"{match.group(1)}:{match.group(2).lower()}"

    return key


# ---------------------------------------------------------------------
# Supabase data retrieval
# ---------------------------------------------------------------------

def fetch_roadmap_data(
    supabase,
    student_id: str,
    role_id: str,
) -> dict:
    role = fetch_one_or_404(
        supabase,
        "job_roles",
        "id",
        role_id,
        "The selected job role was not found.",
    )

    requirements = rows_from(
        supabase.table("role_skill_requirements")
        .select("*")
        .eq("role_id", role_id)
        .execute()
    )

    student_skills = rows_from(
        supabase.table("student_skills")
        .select("*")
        .eq("student_id", student_id)
        .execute()
    )

    projects = rows_from(
        supabase.table("student_projects")
        .select("*")
        .eq("student_id", student_id)
        .execute()
    )

    certifications = rows_from(
        supabase.table("student_certifications")
        .select("*")
        .eq("student_id", student_id)
        .execute()
    )

    saved_progress = rows_from(
        supabase.table("roadmap_task_progress")
        .select("*")
        .eq("student_id", student_id)
        .eq("role_id", role_id)
        .execute()
    )

    skill_ids = {
        str(item["skill_id"])
        for item in requirements + student_skills
        if item.get("skill_id")
    }

    skills_by_id = {}

    if skill_ids:
        response = (
            supabase.table("skills")
            .select("*")
            .in_("id", list(skill_ids))
            .execute()
        )

        for item in rows_from(response):
            skills_by_id[str(item["id"])] = item

    return {
        "role": role,
        "requirements": requirements,
        "student_skills": student_skills,
        "skills_by_id": skills_by_id,
        "projects": projects,
        "certifications": certifications,
        "saved_progress": saved_progress,
    }


def fetch_career_context(supabase) -> dict:
    """
    Load every role, requirement, and skill.

    The career report uses these to measure how many roles need a skill
    and to suggest other roles the student is close to.
    """
    all_roles = rows_from(
        supabase.table("job_roles").select("*").execute()
    )

    all_requirements = rows_from(
        supabase.table("role_skill_requirements").select("*").execute()
    )

    all_skills = rows_from(
        supabase.table("skills").select("*").execute()
    )

    return {
        "roles": all_roles,
        "requirements": all_requirements,
        "skills_by_id": {
            str(item["id"]): item
            for item in all_skills
            if item.get("id")
        },
    }


def get_embedding_model_or_none():
    """Return the embedding model, or None so the report can still run."""
    try:
        return get_embedding_model()
    except Exception:
        logger.exception("Embedding model unavailable for the career report")
        return None


def create_career_report(supabase, data: dict) -> dict:
    """Build the personalized career report from already-loaded student data."""
    context = fetch_career_context(supabase)

    return build_career_report(
        role=data["role"],
        requirements=data["requirements"],
        student_skills=data["student_skills"],
        projects=data["projects"],
        certifications=data["certifications"],
        skills_by_id={
            **context["skills_by_id"],
            **data["skills_by_id"],
        },
        all_roles=context["roles"],
        all_requirements=context["requirements"],
        embedding_model=get_embedding_model_or_none(),
    )


# ---------------------------------------------------------------------
# Student evidence construction
# ---------------------------------------------------------------------

def build_student_evidence(
    student_skills,
    projects,
    certifications,
    skills_by_id,
):
    evidence = []

    for item in student_skills:
        skill_id = str(item.get("skill_id", ""))
        record = skills_by_id.get(skill_id, {})
        name = str(record.get("skill_name") or skill_id)

        evidence.append({
            "type": "skill",
            "title": name,
            "description": (
                f"{name}. Student-recorded proficiency: "
                f"{item.get('proficiency', 0)}/10."
            ),
        })

    for project in projects:
        name = (
            normalize_text(project.get("project_name"))
            or "Student project"
        )
        description = normalize_text(project.get("description"))
        tech_stack = normalize_text(project.get("tech_stack"))

        evidence.append({
            "type": "project",
            "title": name,
            "description": " ".join(
                part for part in [name, description, tech_stack] if part
            ),
            "tech_stack": project.get("tech_stack") or [],
        })

    for cert in certifications:
        name = (
            normalize_text(cert.get("certification_name"))
            or "Certification"
        )
        issuer = normalize_text(cert.get("issuer"))

        evidence.append({
            "type": "certification",
            "title": name,
            "description": " ".join(
                part for part in [name, issuer] if part
            ),
        })

    return evidence


# ---------------------------------------------------------------------
# Roadmap task generation
# ---------------------------------------------------------------------

def get_skill_family(skill_name: str) -> str:
    name = skill_name.lower()

    families = {
        "python": ["python"],
        "sql": ["sql", "database", "postgres", "mysql"],
        "ml": ["machine learning", "scikit", "model evaluation"],
        "api": ["api", "fastapi", "rest", "backend development"],
        "react": ["react", "next.js", "nextjs"],
        "javascript": ["javascript", "typescript"],
        "git": ["git", "github", "version control"],
        "cloud": ["cloud", "aws", "azure", "gcp"],
        "docker": ["docker", "container"],
        "dsa": ["data structure", "algorithm"],
        "web": ["html", "css", "web development"],
    }

    for family, keywords in families.items():
        if any(keyword in name for keyword in keywords):
            return family

    return "general"


def task_templates(
    skill_name: str,
    role_title: str,
) -> list[dict]:
    skill = skill_name.strip() or "this skill"
    family = get_skill_family(skill)

    descriptions = {
        "python": [
            "Study Python syntax, data structures, functions, exceptions, modules, and object-oriented programming.",
            "Solve progressively harder Python exercises and test your solutions with edge cases.",
            "Build a Python application component with input validation and error handling.",
            "Complete a Python exercise independently and explain your implementation decisions.",
        ],
        "sql": [
            "Study relational databases, filtering, joins, aggregations, subqueries, and constraints.",
            "Practise SQL queries using joins, grouping, subqueries, and window functions.",
            "Design a relational schema and implement queries for a realistic application.",
            "Test query correctness against representative data and explain your design choices.",
        ],
        "ml": [
            "Study preprocessing, train-test splits, evaluation metrics, and overfitting.",
            "Train a baseline model and evaluate it using appropriate metrics.",
            "Build a reproducible ML project covering data preparation, training, and prediction.",
            "Evaluate the model on unseen data and explain its limitations.",
        ],
        "api": [
            "Study HTTP methods, status codes, JSON, validation, authentication, and API errors.",
            "Implement endpoints with request validation and appropriate error responses.",
            "Build a REST API connected to a database for a realistic application workflow.",
            "Test valid requests, invalid input, authentication, and error handling.",
        ],
        "react": [
            "Study components, props, state, hooks, rendering, and data fetching.",
            "Build reusable components with forms, loading states, and error handling.",
            "Build a responsive page that consumes an API and displays real data.",
            "Test user flows, validation, empty states, and responsive layouts.",
        ],
        "javascript": [
            "Review functions, arrays, objects, modules, asynchronous code, and language fundamentals.",
            "Practise promises, async/await, array methods, and error handling.",
            "Build a small modular application using asynchronous operations.",
            "Test edge cases and explain your implementation independently.",
        ],
        "git": [
            "Study repositories, commits, branches, merges, pull requests, and conflict resolution.",
            "Practise branching, committing, merging, and resolving a sample conflict.",
            "Publish a project with a useful README and meaningful commit history.",
            "Demonstrate a clean Git workflow and explain your decisions.",
        ],
        "cloud": [
            "Study cloud fundamentals, deployment, access control, monitoring, and cost considerations.",
            "Deploy a small application using a suitable cloud service or guided lab.",
            "Deploy a project and document its architecture and configuration.",
            "Check deployment health, logs, permissions, and basic security settings.",
        ],
        "docker": [
            "Study images, containers, Dockerfiles, ports, environment variables, and networking.",
            "Containerize an application and run it with the correct configuration.",
            "Create a reproducible development environment using Docker.",
            "Rebuild the container and verify that the application works.",
        ],
        "dsa": [
            "Study data structures and algorithm concepts required at your current level.",
            "Solve progressively harder problems and explain time and space complexity.",
            "Implement a project feature using appropriate data structures and algorithms.",
            "Solve problems independently and test boundary cases.",
        ],
        "web": [
            "Study semantic HTML, CSS layouts, responsive design, accessibility, and browser fundamentals.",
            "Build responsive layouts and reusable page sections.",
            "Create an accessible, responsive page for a realistic application.",
            "Test mobile and desktop layouts, keyboard access, and form behavior.",
        ],
        "general": [
            f"Study the fundamentals of {skill}, its main concepts, tools, and use cases for {role_title}.",
            f"Complete practical {skill} exercises, progressing from guided work to independent tasks.",
            f"Build a small feature demonstrating practical use of {skill} in a {role_title} project.",
            f"Complete an independent {skill} exercise, test it, and explain your decisions.",
        ],
    }

    titles = [
        f"Learn {skill} fundamentals",
        f"Practise {skill}",
        f"Build with {skill}",
        f"Verify your {skill} ability",
    ]

    return [
        {
            "type": phase_key,
            "title": titles[index],
            "description": descriptions[family][index],
            "estimated_hours": hours,
        }
        for index, (phase_key, _, hours) in enumerate(PHASES)
    ]


def customize_task_descriptions(
    templates,
    skill_name,
    role_title,
    current,
    required,
    related_evidence,
):
    tasks = [dict(item) for item in templates]
    gap = max(0, required - current)

    if current == 0:
        tasks[0]["description"] = (
            f"Start with the fundamentals of {skill_name}. "
            f"Learn the concepts and tools needed for {role_title}, "
            "then complete an introductory exercise."
        )
        tasks[1]["description"] = (
            f"Practise beginner-level {skill_name} exercises. "
            "Focus on correctness and understanding."
        )
    elif gap >= 4:
        tasks[0]["description"] = (
            f"Strengthen your existing {skill_name} knowledge. "
            f"Identify concepts needed to progress from {current}/10 "
            f"toward the role target of {required}/10."
        )
        tasks[1]["description"] = (
            f"Practise exercises that target the gap between your current "
            f"proficiency ({current}/10) and required proficiency ({required}/10)."
        )
    elif gap > 0:
        tasks[0]["description"] = (
            f"Review the {skill_name} concepts you have not mastered. "
            f"Focus on progressing from {current}/10 toward {required}/10 "
            f"for the {role_title} role."
        )
        tasks[1]["description"] = (
            f"Complete focused {skill_name} exercises to close your remaining "
            "proficiency gap."
        )
    else:
        tasks[0]["description"] = (
            f"Review key {skill_name} concepts and check your understanding "
            f"against the expectations for {role_title}."
        )
        tasks[1]["description"] = (
            f"Complete a practical {skill_name} challenge to validate "
            "and strengthen your existing knowledge."
        )

    project_evidence = [
        item for item in related_evidence
        if item["type"] == "project"
    ]
    certification_evidence = [
        item for item in related_evidence
        if item["type"] == "certification"
    ]
    skill_evidence = [
        item for item in related_evidence
        if item["type"] == "skill"
    ]

    if project_evidence:
        project_names = ", ".join(
            item["title"] for item in project_evidence[:2]
        )

        tasks[2]["title"] = f"Extend an existing {skill_name} project"
        tasks[2]["description"] = (
            f"Build on your existing project(s): {project_names}. "
            f"Add one clearly scoped feature that uses {skill_name}, "
            "handle likely failure cases, and document your implementation "
            f"decisions. Aim to demonstrate progress toward {required}/10."
        )

        tasks[3]["description"] = (
            f"Validate your {skill_name} improvement in {project_names}. "
            "Run relevant checks, explain the design and trade-offs without "
            "reading from notes, and record what you would improve next."
        )
    else:
        tasks[2]["description"] = (
            f"Build a small, self-contained project using {skill_name} that "
            f"demonstrates a realistic {role_title} task. Define the expected "
            "behavior first, implement it, and include a README plus tests "
            "or validation steps where appropriate."
        )

    if skill_evidence:
        known_skills = ", ".join(item["title"] for item in skill_evidence[:2])
        tasks[1]["description"] += (
            f" Connect the exercises to skills you already record: "
            f"{known_skills}."
        )

    if certification_evidence:
        cert_names = ", ".join(
            item["title"] for item in certification_evidence[:2]
        )
        tasks[0]["description"] += (
            f" Use your related certification ({cert_names}) as a reference, "
            "then verify the concepts by applying them in an exercise."
        )

    if gap == 0:
        tasks[3]["title"] = f"Validate and demonstrate {skill_name}"
        tasks[3]["description"] = (
            f"Demonstrate {skill_name} independently in a role-relevant "
            "scenario. Explain your approach, validate the result, and note "
            "one advanced area you would explore next."
        )
    else:
        tasks[3]["description"] += (
            f" Compare your result with the role target of {required}/10, "
            "identify remaining weaknesses, and write down the next practice "
            "step."
        )

    return tasks


# ---------------------------------------------------------------------
# Roadmap construction
# ---------------------------------------------------------------------

def build_roadmap(
    role_id,
    role_title,
    requirements,
    student_skills,
    skills_by_id,
    saved_progress,
    projects,
    certifications,
):
    student_levels = {
        str(item["skill_id"]): int(item.get("proficiency") or 0)
        for item in student_skills
        if item.get("skill_id")
    }

    progress_by_key = {
        normalize_task_key(str(item["task_key"])): item
        for item in saved_progress
        if item.get("task_key")
    }

    evidence = build_student_evidence(
        student_skills,
        projects,
        certifications,
        skills_by_id,
    )

    requirements_by_skill = {}

    for item in requirements:
        skill_id = str(item.get("skill_id") or "")
        if skill_id:
            requirements_by_skill[skill_id] = dict(item)

    for item in student_skills:
        skill_id = str(item.get("skill_id") or "")

        if skill_id and skill_id not in requirements_by_skill:
            requirements_by_skill[skill_id] = {
                "skill_id": skill_id,
                "required_proficiency": int(item.get("proficiency") or 0),
                "importance": "existing",
            }

    def priority(item):
        """Rank role-critical skills first, then favor larger proficiency gaps."""
        skill_id = str(item.get("skill_id") or "")
        current = student_levels.get(skill_id, 0)

        try:
            required = int(item.get("required_proficiency") or 0)
        except (TypeError, ValueError):
            required = 0

        importance = str(item.get("importance") or "medium").lower()
        gap = max(0, required - current)

        # Importance is the main signal; the gap helps order skills within it.
        importance_score = {
            "high": 300,
            "medium": 200,
            "low": 100,
            "existing": 0,
        }.get(importance, 200)

        return (
            -(importance_score + gap * 5 + required),
            -gap,
            skill_id,
        )

    ordered = sorted(requirements_by_skill.values(), key=priority)
    roadmap = []

    for requirement in ordered:
        skill_id = str(requirement["skill_id"])
        record = skills_by_id.get(skill_id, {})
        skill_name = str(record.get("skill_name") or skill_id)

        current = student_levels.get(skill_id, 0)
        importance = str(
            requirement.get("importance") or "medium"
        ).lower()
        required = int(requirement.get("required_proficiency") or 0)

        if importance == "existing":
            required = current

        gap = max(0, required - current)

        related_evidence = find_related_evidence(
            skill_name,
            evidence,
            limit=3,
        )

        templates = customize_task_descriptions(
            templates=task_templates(skill_name, role_title),
            skill_name=skill_name,
            role_title=role_title,
            current=current,
            required=required,
            related_evidence=related_evidence,
        )

        phases = []
        all_tasks = []
        completed = 0
        in_progress = 0
        hours = 0

        for phase_number, (phase_key, label, _) in enumerate(
            PHASES,
            start=1,
        ):
            template = next(
                item for item in templates
                if item["type"] == phase_key
            )

            key = make_task_key(role_id, skill_id, phase_key)
            saved = progress_by_key.get(normalize_task_key(key), {})
            status = saved.get("status", "not_started")

            if status not in VALID_STATUSES:
                status = "not_started"

            task = {
                "task_key": key,
                "type": phase_key,
                "title": template["title"],
                "description": template["description"],
                "estimated_hours": template["estimated_hours"],
                "status": status,
                "completed_at": saved.get("completed_at"),
            }

            phases.append({
                "phase_number": phase_number,
                "phase_key": phase_key,
                "title": label,
                "tasks": [task],
            })

            all_tasks.append(task)
            hours += task["estimated_hours"]

            if status == "completed":
                completed += 1
            elif status == "in_progress":
                in_progress += 1

        total = len(all_tasks)
        percentage = round(completed / total * 100) if total else 0

        if total and completed == total:
            skill_status = "completed"
        elif completed or in_progress:
            skill_status = "in_progress"
        else:
            skill_status = "not_started"

        roadmap.append({
            "skill_id": skill_id,
            "skill_name": skill_name,
            "category": record.get("category"),
            "skill_type": record.get("type"),
            "importance": importance,
            "is_existing_skill": skill_id in student_levels,
            "current_proficiency": current,
            "required_proficiency": required,
            "gap": gap,
            "proficiency_gap": gap,
            "estimated_hours": hours,
            "status": skill_status,
            "progress": {
                "completed_tasks": completed,
                "total_tasks": total,
                "percentage": percentage,
            },
            "total_tasks": total,
            "completed_tasks": completed,
            "next_task": next(
                (
                    task for task in all_tasks
                    if task["status"] != "completed"
                ),
                None,
            ),
            "phases": phases,
            "related_evidence": related_evidence,
        })

    return roadmap


# ---------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "Placement Readiness API is running.",
        "version": "1.3.0",
    }


@app.get("/auth-check")
def auth_check(
    current_user: dict = Depends(get_current_user),
):
    return {
        "authenticated": True,
        "user_id": get_student_id(current_user),
    }


@app.get("/student-data-check")
def student_data_check(
    current_user: dict = Depends(get_current_user),
):
    student_id = get_student_id(current_user)
    supabase = get_supabase_client(current_user["access_token"])

    skills = rows_from(
        supabase.table("student_skills")
        .select("*")
        .eq("student_id", student_id)
        .execute()
    )

    projects = rows_from(
        supabase.table("student_projects")
        .select("*")
        .eq("student_id", student_id)
        .execute()
    )

    certifications = rows_from(
        supabase.table("student_certifications")
        .select("*")
        .eq("student_id", student_id)
        .execute()
    )

    return {
        "student_id": student_id,
        "skill_count": len(skills),
        "project_count": len(projects),
        "certification_count": len(certifications),
    }


@app.post("/roadmap")
def get_roadmap(
    request: RoadmapRequest,
    current_user: dict = Depends(get_current_user),
):
    student_id = get_student_id(current_user)

    try:
        supabase = get_supabase_client(current_user["access_token"])

        data = fetch_roadmap_data(
            supabase,
            student_id,
            request.role_id,
        )

        role = data["role"]

        roadmap = build_roadmap(
            request.role_id,
            str(role.get("title") or "Selected role"),
            data["requirements"],
            data["student_skills"],
            data["skills_by_id"],
            data["saved_progress"],
            data["projects"],
            data["certifications"],
        )

        total_tasks = sum(skill["total_tasks"] for skill in roadmap)

        completed_tasks = sum(
            skill["completed_tasks"] for skill in roadmap
        )

        in_progress_tasks = sum(
            1
            for skill in roadmap
            for phase in skill["phases"]
            for task in phase["tasks"]
            if task["status"] == "in_progress"
        )

        completed_skills = sum(
            1
            for skill in roadmap
            if skill["status"] == "completed"
        )

        return {
            "role": role,
            "roadmap_method": "gap_prioritized_rule_based_semantic_matching",
            "summary": {
                "total_skills": len(roadmap),
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "in_progress_tasks": in_progress_tasks,
                "completed_skills": completed_skills,
                "completion_percentage": (
                    round(completed_tasks / total_tasks * 100)
                    if total_tasks else 0
                ),
            },
            "profile_summary": {
                "student_skills": len(data["student_skills"]),
                "projects": len(data["projects"]),
                "certifications": len(data["certifications"]),
            },
            "roadmap": roadmap,
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Failed to generate roadmap")

        raise HTTPException(
            status_code=500,
            detail=f"{type(exc).__name__}: {exc}",
        ) from exc


@app.post("/career-report")
def get_career_report(
    request: RoadmapRequest,
    current_user: dict = Depends(get_current_user),
):
    student_id = get_student_id(current_user)

    try:
        supabase = get_supabase_client(current_user["access_token"])

        data = fetch_roadmap_data(
            supabase,
            student_id,
            request.role_id,
        )

        return {
            "role": data["role"],
            "career_report": create_career_report(supabase, data),
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Failed to generate career report")

        raise HTTPException(
            status_code=500,
            detail=f"{type(exc).__name__}: {exc}",
        ) from exc


@app.patch("/roadmap/progress")
def update_roadmap_progress(
    request: TaskProgressRequest,
    current_user: dict = Depends(get_current_user),
):
    student_id = get_student_id(current_user)

    if request.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Status must be not_started, in_progress, or completed.",
        )

    try:
        supabase = get_supabase_client(current_user["access_token"])

        data = fetch_roadmap_data(
            supabase,
            student_id,
            request.role_id,
        )

        roadmap = build_roadmap(
            request.role_id,
            str(data["role"].get("title") or "Selected role"),
            data["requirements"],
            data["student_skills"],
            data["skills_by_id"],
            data["saved_progress"],
            data["projects"],
            data["certifications"],
        )

        task_lookup = {
            normalize_task_key(task["task_key"]): task
            for skill in roadmap
            for phase in skill["phases"]
            for task in phase["tasks"]
        }

        submitted_key = normalize_task_key(request.task_key)
        matched_task = task_lookup.get(submitted_key)

        if matched_task is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Task was not found in this roadmap. "
                    "Refresh and try again."
                ),
            )

        now = datetime.now(timezone.utc).isoformat()

        payload = {
            "student_id": student_id,
            "role_id": request.role_id,
            "task_key": matched_task["task_key"],
            "status": request.status,
            "completed_at": (
                now if request.status == "completed" else None
            ),
            "updated_at": now,
        }

        result = (
            supabase.table("roadmap_task_progress")
            .upsert(
                payload,
                on_conflict="student_id,role_id,task_key",
            )
            .execute()
        )

        records = rows_from(result)

        return {
            "message": "Task progress updated successfully.",
            "progress": records[0] if records else payload,
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Failed to update roadmap progress")

        raise HTTPException(
            status_code=500,
            detail="Unable to update task progress. Check the API logs.",
        ) from exc
