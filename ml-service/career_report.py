"""
career_report.py

Explainable career-report engine for the placement readiness app.

No LLM or external API is used. The pieces are:

1. Evidence matching   - exact tech-stack/keyword matches plus local
                         sentence-transformer embeddings (the same model
                         main.py already loads) link projects and
                         certifications to skills.
2. Proficiency model   - declared proficiency is adjusted by how much
                         project/certification evidence backs it up.
3. Readiness model     - importance-weighted share of the role's required
                         proficiency that the student already meets.
4. Priority ranking    - importance x gap x cross-role leverage, with a
                         small prerequisite pass so basics come first.
5. Personalised text   - the report is written as short paragraphs that
                         mention the student's own projects, skills and
                         certifications. Every sentence is composed from
                         real numbers and matches, so it can be traced back.

All tunable numbers live in the constants below. They are sensible starting
points, not learned values: once you have placement outcomes, these are the
numbers to fit from data (see the notes at the bottom of this file).
"""

from __future__ import annotations

import logging
import re
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------
# Tunable parameters
# ---------------------------------------------------------------------

IMPORTANCE_WEIGHT = {"high": 3.0, "medium": 2.0, "low": 1.0}

# How strongly one project / certification proves a skill (0-1).
PROJECT_PROOF = 0.6
CERT_PROOF = 0.5

# Proof at or above this counts as "fully verified" for a skill.
FULL_PROOF = 0.6

# Evidence levels: support >= VERIFIED_LEVEL -> "verified",
# support > 0 -> "partial", otherwise "unverified".
VERIFIED_LEVEL = 0.45

# Embedding cosine similarity is mapped into a 0-1 evidence strength:
# below SEMANTIC_FLOOR counts as no match, SEMANTIC_FLOOR + SEMANTIC_SPAN
# counts as a full match. Semantic matches never beat an exact match.
SEMANTIC_FLOOR = 0.35
SEMANTIC_SPAN = 0.35
SEMANTIC_MAX_STRENGTH = 0.8
MIN_STRENGTH = 0.15

# A skill-to-skill similarity above this counts as "related" when the report
# points to a skill the student already has.
RELATED_SKILL_MIN = 0.30

# A declared skill with no evidence keeps (1 - discount) of its value.
UNVERIFIED_DISCOUNT = 0.25

# A skill that appears in projects/certs but was never rated is capped here.
EVIDENCE_ONLY_CAP = 4.0

MIN_GAP = 0.5            # smaller gaps are treated as "met"
LEVERAGE_STEP = 0.1      # priority boost per other role needing the skill
LEVERAGE_MAX = 5

FOCUS_LIMIT = 5
STRENGTH_LIMIT = 5
OTHER_ROLE_LIMIT = 3
OTHER_ROLE_MIN_FIT = 40

# "dependent skill keyword": "prerequisite skill keyword"
PREREQUISITE_HINTS = {
    "machine learning": "python",
    "deep learning": "machine learning",
    "scikit": "python",
    "pandas": "python",
    "fastapi": "python",
    "django": "python",
    "flask": "python",
    "react": "javascript",
    "next.js": "react",
    "nextjs": "react",
    "kubernetes": "docker",
}


# ---------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------

def _text(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, (list, tuple)):
        return " ".join(str(item) for item in value)

    if isinstance(value, dict):
        return " ".join(f"{key} {item}" for key, item in value.items())

    return str(value)


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _importance(value: Any) -> str:
    text = _text(value).lower()

    if "critical" in text or "high" in text:
        return "high"

    if "low" in text:
        return "low"

    return "medium"


def _requirements_by_skill(rows: list[dict] | None) -> dict[str, dict]:
    result: dict[str, dict] = {}

    for row in rows or []:
        skill_id = str(row.get("skill_id") or "")
        required = _number(row.get("required_proficiency"))

        if skill_id and required > 0:
            result[skill_id] = {
                "skill_id": skill_id,
                "required": min(required, 10.0),
                "importance": _importance(row.get("importance")),
            }

    return result


def _group_by_role(rows: list[dict] | None) -> dict[str, dict[str, dict]]:
    grouped: dict[str, list[dict]] = {}

    for row in rows or []:
        role_id = str(row.get("role_id") or "")

        if role_id:
            grouped.setdefault(role_id, []).append(row)

    return {
        role_id: _requirements_by_skill(items)
        for role_id, items in grouped.items()
    }


# ---------------------------------------------------------------------
# 1. Evidence matching
# ---------------------------------------------------------------------

def _evidence_items(
    projects: list[dict],
    certifications: list[dict],
) -> list[dict]:
    items = []

    for project in projects or []:
        name = _text(project.get("project_name")) or "Student project"
        tech = project.get("tech_stack")

        if isinstance(tech, str):
            tech_list = [t.strip() for t in tech.split(",") if t.strip()]
        else:
            tech_list = [
                _text(t).strip()
                for t in (tech or [])
                if _text(t).strip()
            ]

        parts = [name, _text(project.get("description")), _text(tech)]

        items.append({
            "type": "project",
            "title": name,
            "text": " ".join(part for part in parts if part),
            "tech": {t.lower() for t in tech_list},
            "tech_list": tech_list,
        })

    for cert in certifications or []:
        name = _text(cert.get("certification_name")) or "Certification"
        parts = [name, _text(cert.get("issuer"))]

        items.append({
            "type": "certification",
            "title": name,
            "text": " ".join(part for part in parts if part),
            "tech": set(),
        })

    return items


def _exact_match(skill_name: str, item: dict) -> bool:
    term = skill_name.strip().lower()

    if not term:
        return False

    if term in item["tech"]:
        return True

    if len(term) < 3:
        # Very short names ("C", "R") only count when listed in a tech stack.
        return False

    pattern = r"(?<![a-z0-9])" + re.escape(term) + r"(?![a-z0-9])"
    return re.search(pattern, item["text"].lower()) is not None


def _strength_matrix(
    skill_names: list[str],
    items: list[dict],
    embedding_model: Any,
) -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None]:
    """
    Evidence strength (0-1) for every skill x evidence item.

    Also returns the raw embedding similarities (skill x evidence item and
    skill x skill) so the explanations can point to the student's most
    related project or skill. Both are None when no model is available.
    """

    strength = np.zeros((len(skill_names), len(items)))
    item_similarity = None
    skill_similarity = None

    if not skill_names:
        return strength, item_similarity, skill_similarity

    for s_index, name in enumerate(skill_names):
        for i_index, item in enumerate(items):
            if _exact_match(name, item):
                strength[s_index, i_index] = 1.0

    if embedding_model is not None:
        try:
            vectors = embedding_model.encode(
                skill_names + [item["text"] for item in items],
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            )

            skill_vectors = vectors[: len(skill_names)]
            item_vectors = vectors[len(skill_names):]

            skill_similarity = skill_vectors @ skill_vectors.T

            if len(items):
                item_similarity = skill_vectors @ item_vectors.T

                semantic = np.clip(
                    (item_similarity - SEMANTIC_FLOOR) / SEMANTIC_SPAN,
                    0.0,
                    1.0,
                ) * SEMANTIC_MAX_STRENGTH

                strength = np.maximum(strength, semantic)

        except Exception:
            logger.exception("Semantic evidence matching failed")
            item_similarity = None
            skill_similarity = None

    return strength, item_similarity, skill_similarity


def _support(row: np.ndarray, items: list[dict]) -> tuple[float, list[dict]]:
    """Combine several pieces of evidence into one 0-1 support value."""

    miss = 1.0
    matches = []

    for value, item in zip(row, items):
        strength = float(value)

        if strength < MIN_STRENGTH:
            continue

        proof = PROJECT_PROOF if item["type"] == "project" else CERT_PROOF
        miss *= 1.0 - strength * proof

        matches.append({
            "type": item["type"],
            "title": item["title"],
            "strength": round(strength, 2),
        })

    matches.sort(key=lambda match: match["strength"], reverse=True)

    return 1.0 - miss, matches[:3]


def _evidence_level(support: float) -> str:
    if support >= VERIFIED_LEVEL:
        return "verified"

    if support > 0:
        return "partial"

    return "unverified"


# ---------------------------------------------------------------------
# 2-3. Proficiency and readiness models
# ---------------------------------------------------------------------

def _effective_proficiency(declared: float, support: float) -> float:
    verified = min(1.0, support / FULL_PROOF)

    if declared > 0:
        return declared * ((1.0 - UNVERIFIED_DISCOUNT) + UNVERIFIED_DISCOUNT * verified)

    return EVIDENCE_ONLY_CAP * verified


def _readiness(requirements: dict[str, dict], analysis: dict[str, dict]) -> float:
    numerator = 0.0
    denominator = 0.0

    for skill_id, req in requirements.items():
        weight = IMPORTANCE_WEIGHT[req["importance"]]
        effective = analysis.get(skill_id, {}).get("effective", 0.0)

        numerator += weight * min(effective, req["required"])
        denominator += weight * req["required"]

    return 100.0 * numerator / denominator if denominator else 0.0


def _readiness_label(score: float) -> str:
    if score >= 85:
        return "Placement-ready"

    if score >= 65:
        return "Close to ready"

    if score >= 40:
        return "Developing"

    return "Getting started"


# ---------------------------------------------------------------------
# 4. Prerequisite ordering
# ---------------------------------------------------------------------

def _apply_prerequisites(focus: list[dict]) -> list[dict]:
    """Move a prerequisite skill ahead of the skill that builds on it."""

    names = [item["skill_name"].lower() for item in focus]
    ordered: list[dict] = []
    placed: set[int] = set()

    def place(index: int, stack: tuple[int, ...] = ()) -> None:
        if index in placed:
            return

        for dependent, prerequisite in PREREQUISITE_HINTS.items():
            if dependent not in names[index]:
                continue

            for other, other_name in enumerate(names):
                if other == index or other in stack:
                    continue

                if prerequisite in other_name:
                    place(other, stack + (index,))
                    focus[index].setdefault("prerequisites", []).append(
                        focus[other]["skill_name"]
                    )
                    break

        placed.add(index)
        ordered.append(focus[index])

    for index in range(len(focus)):
        place(index)

    return ordered


# ---------------------------------------------------------------------
# 5. Personalised explanations
# ---------------------------------------------------------------------

def _plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def _join_names(names: list[str]) -> str:
    names = [name for name in names if name]

    if not names:
        return ""

    if len(names) == 1:
        return names[0]

    return ", ".join(names[:-1]) + " and " + names[-1]


def _pick(options: list[str], seed: int) -> str:
    """Deterministic variety, so neighbouring paragraphs do not read alike."""
    return options[seed % len(options)]


def _narrate_focus(item: dict, ctx: dict, seed: int) -> str:
    """Write one short, profile-specific paragraph for a focus area."""

    name = item["skill_name"]
    role = ctx["role_title"]
    declared = item["declared_proficiency"]
    current = item["current_proficiency"]
    required = item["required_proficiency"]
    gain = item["readiness_gain"]
    level = item["evidence_level"]
    matches = item["evidence"]

    sentences = []

    # 1. Why this skill matters for the chosen role.
    if item["importance"] == "high":
        sentences.append(_pick([
            f"{name} is a core requirement for a {role}, worth roughly {gain:.0f} points of your readiness on its own.",
            f"For a {role}, {name} is treated as essential, and closing this gap would lift your readiness by about {gain:.0f} points.",
            f"{name} sits at the centre of what a {role} is expected to do, and it accounts for about {gain:.0f} points of your readiness.",
        ], seed))
    elif item["importance"] == "medium":
        sentences.append(_pick([
            f"{name} is an important part of the {role} skill set, worth about {gain:.0f} points of readiness.",
            f"A {role} is expected to be comfortable with {name}, and improving it would add about {gain:.0f} points to your readiness.",
        ], seed))
    else:
        sentences.append(_pick([
            f"{name} is a useful extra for a {role}, adding about {gain:.0f} points of readiness once covered.",
            f"{name} is more of a bonus than a must-have for a {role}, but it is worth about {gain:.0f} points.",
        ], seed))

    # 2. Where this student stands today.
    related = ctx["related"](item["skill_id"])

    if declared <= 0 and current <= 0:
        if related:
            sentences.append(
                f"It is not on your profile yet, but you already list {related['name']} "
                f"at {related['level']:.0f}/10 and the two overlap, so you are not starting from zero."
            )
        else:
            sentences.append(_pick([
                f"It is not on your profile yet, and the role expects about {required:.0f}/10.",
                f"You have not recorded {name} so far, so this is a new area for you (the role expects about {required:.0f}/10).",
                f"Nothing on your profile covers {name} yet, and the role asks for about {required:.0f}/10.",
            ], seed))
    elif declared <= 0:
        top = matches[0]
        sentences.append(
            f"Your {top['type']} \"{top['title']}\" uses it, though you have not rated it yourself, "
            f"so it counts as about {current:.1f}/10 against the {required:.0f}/10 target."
        )
    elif level == "unverified":
        if ctx["project_count"] + ctx["cert_count"] == 0:
            sentences.append(
                f"You rated yourself {declared:.0f}/10, but there are no projects or certifications on your "
                f"profile yet to back that up, so it counts as about {current:.1f}/10 against the {required:.0f}/10 target."
            )
        else:
            sentences.append(
                f"You rated yourself {declared:.0f}/10, but none of your projects or certifications show it, "
                f"so it counts as about {current:.1f}/10 against the {required:.0f}/10 target."
            )
    else:
        top = matches[0]
        sentences.append(
            f"You are at about {current:.1f}/10, and your {top['type']} \"{top['title']}\" already shows part of it, "
            f"but the role expects {required:.0f}/10."
        )

    # 3. What to do next, using the student's own work where possible.
    if item["gap"] >= 4 and declared <= 0 and seed <= 2:
        sentences.append(
            "With a gap this size, spend the first stretch on the fundamentals and move to hands-on work quickly."
        )

    prerequisites = item.get("prerequisites")
    project = ctx["best_project"](item["skill_id"], matches)

    if prerequisites:
        sentences.append(
            f"Because it builds on {_join_names(prerequisites)}, which is also on your gap list, "
            f"start there first and come back to {name} afterwards."
        )
    elif project:
        title = project["title"]
        built_with = (
            f" (built with {_join_names(project['tech'][:3])})"
            if project["tech"] else ""
        )

        sentences.append(_pick([
            f"A practical way in is to extend your project \"{title}\"{built_with} with a feature that relies on {name}, then add the result to your profile.",
            f"Your project \"{title}\"{built_with} is the natural place to practise this: add one feature that uses {name} and document what you did.",
            f"You could fold {name} into \"{title}\"{built_with}, which turns an existing project into proof of the skill.",
        ], seed))
    elif ctx["project_count"] == 0:
        sentences.append(
            f"You have no projects on your profile yet, so a small project built around {name} "
            "would both teach the skill and give you something to talk about in interviews."
        )
    else:
        sentences.append(
            f"Build a small project around {name} and add it to your profile so it is backed by real work."
        )

    # 4. Why it keeps paying off.
    if item["also_needed_by_roles"] >= 2:
        sentences.append(
            f"It also appears in {item['also_needed_by_roles']} other roles, "
            "so the effort carries over if you change direction."
        )

    return " ".join(sentences)


def _build_summary(
    *,
    role_title: str,
    score: float,
    label: str,
    profile: dict,
    strengths: list[dict],
    focus_all: list[dict],
    top_focus: list[dict],
    unverified: list[str],
    what_if: dict | None,
    skills_by_id: dict[str, dict],
) -> tuple[list[str], str]:
    """Write the opening paragraphs and the closing paragraph of the report."""

    paragraphs = []

    paragraphs.append(
        f"Your profile has {_plural(profile['declared_skills'], 'skill')}, "
        f"{_plural(profile['projects'], 'project')} and "
        f"{_plural(profile['certifications'], 'certification')}. "
        f"Measured against what a {role_title} needs, you currently meet about "
        f"{round(score)}% of the requirements, which puts you at the \"{label.lower()}\" stage."
    )

    if strengths:
        names = _join_names([item["skill_name"] for item in strengths[:3]])
        text = f"You already meet the target for {names}"
        verified = [item for item in strengths if item["evidence_level"] == "verified"]

        if verified:
            text += f", and {verified[0]['skill_name']} is properly backed by your work"

        paragraphs.append(text + ".")
    else:
        paragraphs.append(
            "You do not fully meet any requirement for this role yet, which is normal early on, "
            "so the focus areas below are about building a solid base."
        )

    gap_sentences = []
    categories: dict[str, list[str]] = {}

    for item in focus_all:
        category = skills_by_id.get(item["skill_id"], {}).get("category")

        if category:
            categories.setdefault(str(category), []).append(item["skill_name"])

    clustered = max(categories.items(), key=lambda pair: len(pair[1]), default=None)

    if clustered and len(clustered[1]) >= 2:
        quantity = "Most" if len(clustered[1]) * 2 >= len(focus_all) else "Several"
        gap_sentences.append(
            f"{quantity} of your remaining gaps sit in {clustered[0]}, including {_join_names(clustered[1][:3])}."
        )

    if len(focus_all) > len(top_focus):
        gap_sentences.append(
            f"In total, {len(focus_all)} skills are below the role target, "
            f"and the {len(top_focus)} that matter most are covered below."
        )
    elif focus_all:
        gap_sentences.append(
            f"{_plural(len(focus_all), 'skill area')} "
            f"{'is' if len(focus_all) == 1 else 'are'} below the role target, and each is covered below."
        )

    if gap_sentences:
        paragraphs.append(" ".join(gap_sentences))

    if unverified:
        many = len(unverified) > 1
        paragraphs.append(
            f"{_join_names(unverified[:3])} {'are' if many else 'is'} listed on your profile but not backed "
            f"by any project or certification, so the report counts {'them' if many else 'it'} for less than "
            "your own rating. Adding evidence is the quickest way to recover those points."
        )

    if top_focus and what_if:
        names = _join_names([item["skill_name"] for item in top_focus[:3]])
        closing = (
            f"If you work through {names}, you could move from about {round(score)}% to roughly "
            f"{what_if['readiness']}% for this role. Start with {top_focus[0]['skill_name']} and add each "
            "result to your profile as you go, so the report can recognize your progress."
        )
    else:
        closing = (
            f"You meet every listed requirement for {role_title}. "
            "The next step is proving your skills through projects and certifications."
        )

    return paragraphs, closing


# ---------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------

def build_career_report(
    *,
    role: dict,
    requirements: list[dict],
    student_skills: list[dict],
    projects: list[dict],
    certifications: list[dict],
    skills_by_id: dict[str, dict],
    all_roles: list[dict] | None = None,
    all_requirements: list[dict] | None = None,
    embedding_model: Any = None,
) -> dict:
    """Build the career report for one student and one target role."""

    role_id = str(role.get("id") or "")
    role_title = str(role.get("title") or "this role")

    target_reqs = _requirements_by_skill(requirements)
    roles_reqs = _group_by_role(all_requirements)

    if role_id and role_id not in roles_reqs:
        roles_reqs[role_id] = target_reqs

    declared = {
        str(row["skill_id"]): max(0.0, min(10.0, _number(row.get("proficiency"))))
        for row in student_skills or []
        if row.get("skill_id")
    }

    # Every skill that matters anywhere in this report.
    skill_id_set = set(declared) | set(target_reqs)

    for reqs in roles_reqs.values():
        skill_id_set |= set(reqs)

    skill_ids = sorted(skill_id_set)
    index_of = {skill_id: index for index, skill_id in enumerate(skill_ids)}

    names = {
        skill_id: str(
            skills_by_id.get(skill_id, {}).get("skill_name") or skill_id
        )
        for skill_id in skill_ids
    }

    items = _evidence_items(projects, certifications)
    project_indices = [i for i, item in enumerate(items) if item["type"] == "project"]

    matrix, item_similarity, skill_similarity = _strength_matrix(
        [names[skill_id] for skill_id in skill_ids],
        items,
        embedding_model,
    )

    analysis: dict[str, dict] = {}

    for index, skill_id in enumerate(skill_ids):
        support, matches = _support(matrix[index], items)

        analysis[skill_id] = {
            "name": names[skill_id],
            "declared": declared.get(skill_id, 0.0),
            "support": support,
            "level": _evidence_level(support),
            "effective": _effective_proficiency(declared.get(skill_id, 0.0), support),
            "matches": matches,
        }

    # ---- helpers that let the text point to the student's own profile ----

    def related_skill(skill_id: str) -> dict | None:
        """The skill the student already has that overlaps most with this one."""
        best_id = None
        best_score = RELATED_SKILL_MIN

        if skill_similarity is not None:
            for other_id, level in declared.items():
                if other_id == skill_id or level <= 0:
                    continue

                similarity = float(
                    skill_similarity[index_of[skill_id], index_of[other_id]]
                )

                if similarity > best_score:
                    best_id, best_score = other_id, similarity

        if best_id is None:
            skill_name = analysis[skill_id]["name"].lower()

            for dependent, prerequisite in PREREQUISITE_HINTS.items():
                if dependent not in skill_name:
                    continue

                for other_id, level in declared.items():
                    if level > 0 and prerequisite in analysis[other_id]["name"].lower():
                        best_id = other_id
                        break

                if best_id:
                    break

        if best_id is None:
            return None

        return {"name": analysis[best_id]["name"], "level": declared[best_id]}

    def best_project(skill_id: str, matches: list[dict]) -> dict | None:
        """The student's project where this skill fits most naturally."""
        if not project_indices:
            return None

        chosen = None

        for match in matches:
            if match["type"] == "project":
                chosen = next(
                    (i for i in project_indices if items[i]["title"] == match["title"]),
                    None,
                )
                break

        if chosen is None and item_similarity is not None:
            row = item_similarity[index_of[skill_id]]
            chosen = max(project_indices, key=lambda i: float(row[i]))

        if chosen is None:
            chosen = project_indices[0]

        return {
            "title": items[chosen]["title"],
            "tech": items[chosen]["tech_list"],
        }

    # ---- readiness --------------------------------------------------

    score = _readiness(target_reqs, analysis)

    denominator = sum(
        IMPORTANCE_WEIGHT[req["importance"]] * req["required"]
        for req in target_reqs.values()
    )

    roles_by_skill: dict[str, set[str]] = {}

    for other_role_id, reqs in roles_reqs.items():
        for skill_id in reqs:
            roles_by_skill.setdefault(skill_id, set()).add(other_role_id)

    # ---- focus areas ------------------------------------------------

    focus = []

    for skill_id, req in target_reqs.items():
        info = analysis[skill_id]
        gap = max(0.0, req["required"] - info["effective"])

        if gap < MIN_GAP:
            continue

        weight = IMPORTANCE_WEIGHT[req["importance"]]
        also_needed = len(roles_by_skill.get(skill_id, set()) - {role_id})
        leverage = 1.0 + LEVERAGE_STEP * min(also_needed, LEVERAGE_MAX)

        focus.append({
            "skill_id": skill_id,
            "skill_name": info["name"],
            "importance": req["importance"],
            "declared_proficiency": round(info["declared"], 1),
            "current_proficiency": round(info["effective"], 1),
            "required_proficiency": round(req["required"], 1),
            "gap": round(gap, 1),
            "evidence_level": info["level"],
            "evidence": info["matches"],
            "also_needed_by_roles": also_needed,
            "readiness_gain": round(100.0 * weight * gap / denominator, 1) if denominator else 0.0,
            "priority": round(weight * gap * leverage, 2),
        })

    focus.sort(key=lambda item: item["priority"], reverse=True)
    focus = _apply_prerequisites(focus)

    priority_order = [item["skill_id"] for item in focus]

    top_focus = focus[:FOCUS_LIMIT]

    narrative_context = {
        "role_title": role_title,
        "project_count": len(projects or []),
        "cert_count": len(certifications or []),
        "related": related_skill,
        "best_project": best_project,
    }

    for rank, item in enumerate(top_focus, start=1):
        item["rank"] = rank
        item["explanation"] = _narrate_focus(item, narrative_context, rank)

    # ---- strengths --------------------------------------------------

    strengths = []

    for skill_id, req in target_reqs.items():
        info = analysis[skill_id]

        if req["required"] - info["effective"] >= MIN_GAP:
            continue

        if info["level"] == "verified" and info["matches"]:
            top = info["matches"][0]
            note = (
                f"Meets the {req['required']:.0f}/10 target and is backed by your "
                f"{top['type']} \"{top['title']}\"."
            )
        else:
            note = (
                f"Meets the {req['required']:.0f}/10 target on paper. "
                "Add a project or certification to prove it."
            )

        strengths.append({
            "skill_id": skill_id,
            "skill_name": info["name"],
            "required_proficiency": round(req["required"], 1),
            "evidence_level": info["level"],
            "note": note,
            "_weight": IMPORTANCE_WEIGHT[req["importance"]] * req["required"],
        })

    strengths.sort(key=lambda item: item["_weight"], reverse=True)

    for item in strengths:
        item.pop("_weight", None)

    strengths = strengths[:STRENGTH_LIMIT]

    # ---- profile insights ------------------------------------------

    unverified = [
        analysis[skill_id]["name"]
        for skill_id in declared
        if declared[skill_id] > 0 and analysis[skill_id]["level"] == "unverified"
    ]

    profile_insights = {
        "declared_skills": sum(1 for value in declared.values() if value > 0),
        "unverified_skills": unverified[:5],
        "unverified_count": len(unverified),
        "projects": len(projects or []),
        "certifications": len(certifications or []),
    }

    # ---- other roles -----------------------------------------------

    other_roles = []

    for role_row in all_roles or []:
        other_id = str(role_row.get("id") or "")
        reqs = roles_reqs.get(other_id)

        if not other_id or other_id == role_id or not reqs:
            continue

        fit = round(_readiness(reqs, analysis))

        if fit >= OTHER_ROLE_MIN_FIT:
            other_roles.append({
                "role_id": other_id,
                "title": str(role_row.get("title") or "Job role"),
                "fit": fit,
            })

    other_roles.sort(key=lambda item: item["fit"], reverse=True)
    other_roles = other_roles[:OTHER_ROLE_LIMIT]

    # ---- what-if and written summary --------------------------------

    what_if = None

    if top_focus:
        count = min(3, len(top_focus))
        gain = sum(item["readiness_gain"] for item in top_focus[:count])

        what_if = {
            "top_focus_count": count,
            "readiness": round(min(100.0, score + gain)),
        }

    rounded_score = round(score)

    if not target_reqs:
        summary = [f"No skill requirements are defined for {role_title} yet."]
        closing = ""
    elif not declared and not items:
        summary = [
            "Add your skills, projects, and certifications so this report "
            "can compare them with the role."
        ]
        closing = ""
    else:
        summary, closing = _build_summary(
            role_title=role_title,
            score=score,
            label=_readiness_label(score),
            profile=profile_insights,
            strengths=strengths,
            focus_all=focus,
            top_focus=top_focus,
            unverified=unverified,
            what_if=what_if,
            skills_by_id=skills_by_id,
        )

    clean_focus = []

    for item in top_focus:
        clean_focus.append({
            key: value
            for key, value in item.items()
            if key not in {"priority", "prerequisites"}
        })

    return {
        "summary": summary,
        "closing": closing,
        "readiness": {
            "score": rounded_score,
            "label": _readiness_label(score),
        },
        "focus_areas": clean_focus,
        "priority_order": priority_order,
        "strengths": strengths,
        "profile_insights": profile_insights,
        "other_roles": other_roles,
        "what_if": what_if,
        "method": (
            "Skills are matched to your projects and certifications with a local "
            "embedding model and keyword matching. Unproven skills count for less, "
            "and focus areas are ranked by importance, gap size, and how many roles "
            "need the skill."
        ),
    }


# ---------------------------------------------------------------------
# Next step: learning the numbers from data
# ---------------------------------------------------------------------
# Once you record placement outcomes (student profile at the time, target
# role, placed or not), the constants above can be fitted instead of set by
# hand. A simple route: build one feature row per student and role (weighted
# gaps, evidence levels, project and certification counts), train a logistic
# regression or gradient-boosting classifier on "placed", and use its
# coefficients or SHAP values to replace IMPORTANCE_WEIGHT and the discount.
# Do not train that model on made-up labels; it would only learn your guesses.


if __name__ == "__main__":
    # Quick self-test with sample data (keyword matching only, no model).
    import json

    demo = build_career_report(
        role={"id": "r1", "title": "Software Developer"},
        requirements=[
            {"skill_id": "ps", "required_proficiency": 8, "importance": "high"},
            {"skill_id": "algo", "required_proficiency": 8, "importance": "high"},
            {"skill_id": "py", "required_proficiency": 7, "importance": "high"},
            {"skill_id": "test", "required_proficiency": 6, "importance": "high"},
            {"skill_id": "cpp", "required_proficiency": 7, "importance": "medium"},
        ],
        student_skills=[
            {"skill_id": "py", "proficiency": 5},
        ],
        projects=[
            {
                "project_name": "Expense Tracker",
                "description": "A small web app to log daily spending.",
                "tech_stack": ["React", "Node"],
            }
        ],
        certifications=[],
        skills_by_id={
            "ps": {"skill_name": "Problem Solving", "category": "Core Programming"},
            "algo": {"skill_name": "Algorithms", "category": "Core Programming"},
            "py": {"skill_name": "Python", "category": "Languages"},
            "test": {"skill_name": "Testing", "category": "Engineering Practice"},
            "cpp": {"skill_name": "C++", "category": "Languages"},
        },
        all_roles=[{"id": "r1", "title": "Software Developer"}],
        all_requirements=[
            {"role_id": "r1", "skill_id": "ps", "required_proficiency": 8, "importance": "high"},
            {"role_id": "r1", "skill_id": "algo", "required_proficiency": 8, "importance": "high"},
            {"role_id": "r1", "skill_id": "py", "required_proficiency": 7, "importance": "high"},
            {"role_id": "r1", "skill_id": "test", "required_proficiency": 6, "importance": "high"},
            {"role_id": "r1", "skill_id": "cpp", "required_proficiency": 7, "importance": "medium"},
        ],
    )

    print(json.dumps(demo, indent=2))
