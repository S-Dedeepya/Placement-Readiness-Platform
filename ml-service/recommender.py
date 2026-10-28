
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def calculate_similarity(
    student_text: list[str],
    target_skill_text: list[str],
) -> list[list[float]]:
    """Compare student evidence with target skill descriptions."""

    if not student_text or not target_skill_text:
        return []

    documents = student_text + target_skill_text

    vectorizer = TfidfVectorizer(stop_words="english")

    try:
        vectors = vectorizer.fit_transform(documents)
    except ValueError:
        # For example, every document may contain only stop words.
        return [
            [0.0 for _ in student_text]
            for _ in target_skill_text
        ]

    student_vectors = vectors[:len(student_text)]
    skill_vectors = vectors[len(student_text):]

    similarities = cosine_similarity(skill_vectors, student_vectors)

    return similarities.tolist()



def recommend_matching_evidence(
    student_text: list[str],
    target_skill_text: list[str],
) -> list[dict]:
    """Return the best evidence only when a meaningful text match exists."""

    similarities = calculate_similarity(
        student_text,
        target_skill_text,
    )

    if not similarities:
        return []

    results = []

    for index, scores in enumerate(similarities):
        best_match_index = max(
            range(len(scores)),
            key=lambda i: scores[i],
        )

        best_score = float(scores[best_match_index])

        results.append({
            "target_skill": target_skill_text[index],
            "closest_student_evidence": (
                student_text[best_match_index]
                if best_score > 0
                else None
            ),
            "similarity": round(best_score, 4),
        })

    return results
