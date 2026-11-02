from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.services.brief_service import build_research_brief
from app.services.comparison_service import compare_papers
from app.services.insight_service import build_research_summary

client = TestClient(app)


def test_build_research_summary_extracts_signals_from_saved_papers():
    papers = [
        {
            "title": "Emotion Recognition with Deep Learning",
            "abstract": "A multimodal deep learning system for facial emotion recognition in real-time conditions.",
            "source": "arXiv",
        },
        {
            "title": "Multimodal Affect Recognition in Social Interaction",
            "abstract": "This study evaluates audio and video fusion for affective computing and sentiment analysis.",
            "source": "Crossref",
        },
        {
            "title": "Human-Computer Interaction for Affective Systems",
            "abstract": "Design principles for adaptive interfaces and user-facing sentiment-aware systems.",
            "source": "Semantic Scholar",
        },
    ]

    summary = build_research_summary(papers)

    assert summary["headline"]
    assert "3 saved papers" in summary["overview"].lower()
    assert any("emotion" in tag.lower() or "affective" in tag.lower() for tag in summary["keywords"])
    assert len(summary["recommendations"]) >= 3
    assert summary["paper_count"] == 3
    assert summary["source_count"] == 3
    assert summary["keyword_evidence"]
    assert all(entry["paper_count"] > 0 and entry["papers"] for entry in summary["keyword_evidence"])
    assert "strong path" not in summary["headline"].lower()
    assert "strong emphasis" not in summary["overview"].lower()
    assert "source_breakdown" in summary
    assert "trend_focus" in summary
    assert "method_focus" in summary
    assert "research_gaps" in summary
    assert summary["source_breakdown"]
    assert summary["method_focus"]
    assert summary["research_gaps"]


def test_empty_research_summary_does_not_invent_terms_or_gaps():
    summary = build_research_summary([])

    assert summary["paper_count"] == 0
    assert summary["source_count"] == 0
    assert summary["keyword_evidence"] == []
    assert summary["method_focus"] == []
    assert summary["research_gaps"] == []


def test_dashboard_tracks_saved_papers_as_analyzed_activity():
    email = f"{uuid4().hex[:8]}@example.com"
    password = "Password123!"
    client.post(
        "/api/auth/register",
        json={"name": "Insight User", "email": email, "password": password},
    )
    token = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        "/api/library/save-paper",
        json={
            "title": "Emotion Recognition in Context",
            "authors": "A. Lee",
            "abstract": "This paper presents context-aware emotion recognition. We evaluate the model on a benchmark dataset.",
            "source": "Crossref",
            "url": "https://example.org/emotion-context",
            "publication_year": 2025,
        },
        headers=headers,
    )

    dashboard = client.get("/api/dashboard", headers=headers)
    payload = dashboard.json()

    assert dashboard.status_code == 200
    assert payload["saved_papers"] >= 1
    assert payload["papers_analyzed"] >= 1
    assert "analysis" in payload["research_activity"].lower() or "active" in payload["research_activity"].lower()

    brief = client.get("/api/brief", headers=headers)
    assert brief.status_code == 200
    brief_payload = brief.json()
    emotion_theme = next(theme for theme in brief_payload["themes"] if theme["name"] == "Emotion recognition")
    supporting_paper = next(paper for paper in emotion_theme["papers"] if paper["title"] == "Emotion Recognition in Context")
    assert supporting_paper["source"] == "Crossref"
    assert supporting_paper["publication_year"] == 2025
    assert supporting_paper["url"] == "https://example.org/emotion-context"
    assert brief_payload["publication_activity"] == [{"year": 2025, "count": 1}]
    assert brief_payload["publication_momentum"] == "Insufficient dated papers"
    insights = client.get("/api/insights", headers=headers)
    assert insights.status_code == 200
    insight_payload = insights.json()
    emotion_term = next(entry for entry in insight_payload["keyword_evidence"] if entry["term"] == "emotion")
    assert emotion_term["paper_count"] == 1
    assert emotion_term["papers"][0]["url"] == "https://example.org/emotion-context"
    api_extraction = next(
        item for item in brief_payload["study_extractions"]
        if item["paper"]["title"] == "Emotion Recognition in Context"
    )
    evaluation_signal = next(signal for signal in api_extraction["signals"] if signal["category"] == "Evaluation")
    assert evaluation_signal["evidence"] == ["We evaluate the model on a benchmark dataset."]


def test_build_research_brief_groups_themes_and_strength():
    papers = [
        {
            "title": "Affective State Recognition with Multimodal Fusion",
            "abstract": "This study combines vision and speech to detect emotion in social settings.",
            "source": "arXiv",
        },
        {
            "title": "Context-Aware Sentiment Modeling for Interfaces",
            "abstract": "The paper models interaction context to estimate user sentiment and engagement.",
            "source": "Crossref",
        },
        {
            "title": "Human-Centered Design for Affective Interfaces",
            "abstract": "Design patterns for responsive emotional interfaces in real deployments.",
            "source": "Semantic Scholar",
        },
    ]

    brief = build_research_brief(papers)

    assert brief["title"]
    assert len(brief["themes"]) >= 2
    assert brief["evidence_strength"] in {"High", "Moderate", "Emerging"}
    assert brief["next_actions"]
    emotion_theme = next(theme for theme in brief["themes"] if theme["name"] == "Emotion recognition")
    assert emotion_theme["paper_count"] == 2
    assert emotion_theme["sources"] == ["Semantic Scholar", "arXiv"]
    assert {paper["title"] for paper in emotion_theme["papers"]} == {papers[0]["title"], papers[2]["title"]}
    assert emotion_theme["evidence_strength"] == "Emerging"
    assert brief["publication_activity"] == []
    assert brief["publication_momentum"] == "Insufficient dated papers"
    assert brief["momentum_comparison"] is None


def test_build_research_brief_reports_publication_activity_and_momentum():
    papers = [
        {"title": "Emotion Recognition", "source": "arXiv", "publication_year": 2023},
        {"title": "Affective Interaction", "source": "Crossref", "publication_year": 2024},
        {"title": "Emotion in Interfaces", "source": "PubMed", "publication_year": 2024},
        {"title": "Undated study", "source": "Crossref"},
    ]

    brief = build_research_brief(papers)

    assert brief["publication_activity"] == [
        {"year": 2023, "count": 1},
        {"year": 2024, "count": 2},
    ]
    assert brief["publication_momentum"] == "Increasing"
    assert brief["momentum_comparison"] == {
        "latest_year": 2024,
        "latest_count": 2,
        "previous_year": 2023,
        "previous_count": 1,
    }


def test_build_research_brief_compares_explicit_method_signals():
    papers = [
        {
            "title": "Multimodal Emotion Benchmark",
            "abstract": "A deep learning neural network combines audio-visual fusion on a benchmark dataset.",
            "source": "arXiv",
        },
        {
            "title": "Affective Interfaces in Practice",
            "abstract": "We conducted a user study with participants in a real-world deployment.",
            "source": "Crossref",
        },
    ]

    brief = build_research_brief(papers)
    methods = {entry["name"]: entry for entry in brief["method_coverage"]}

    assert methods["Deep learning"]["paper_count"] == 1
    assert methods["Multimodal fusion"]["papers"][0]["title"] == papers[0]["title"]
    assert methods["Benchmark evaluation"]["paper_count"] == 1
    assert methods["Human-participant evaluation"]["paper_count"] == 1
    assert methods["Deployment evaluation"]["papers"][0]["title"] == papers[1]["title"]


def test_build_research_brief_recommends_actions_from_missing_signals():
    brief = build_research_brief([
        {
            "title": "Deep Learning for Emotion Recognition",
            "abstract": "A neural network recognizes affective states from facial expressions.",
            "source": "arXiv",
        }
    ])

    actions = [action.lower() for action in brief["next_actions"]]
    assert any("deployment evaluation" in action for action in actions)
    assert any("participant" in action for action in actions)
    assert all("titles or abstracts" in action for action in actions)


def test_build_research_brief_reports_momentum_per_theme():
    papers = [
        {"title": "Emotion Recognition", "source": "arXiv", "publication_year": 2023},
        {"title": "Affective State Recognition", "source": "Crossref", "publication_year": 2024},
        {"title": "Emotion in Interfaces", "source": "PubMed", "publication_year": 2024},
        {"title": "Sentiment in Conversations", "source": "Crossref", "publication_year": 2023},
    ]

    brief = build_research_brief(papers)
    themes = {theme["name"]: theme for theme in brief["themes"]}

    assert themes["Emotion recognition"]["publication_activity"] == [
        {"year": 2023, "count": 1},
        {"year": 2024, "count": 2},
    ]
    assert themes["Emotion recognition"]["publication_momentum"] == "Increasing"
    assert themes["Context-aware sentiment"]["publication_momentum"] == "Insufficient dated papers"


def test_build_research_brief_extracts_cited_abstract_signals():
    papers = [{
        "title": "Multimodal Emotion Recognition",
        "source": "arXiv",
        "publication_year": 2025,
        "url": "https://example.org/paper",
        "abstract": (
            "We propose a multimodal transformer model for emotion recognition. "
            "We evaluate the model on the IEMOCAP dataset and report improved F1 score. "
            "A limitation is the small participant group in the laboratory setting."
        ),
    }]

    brief = build_research_brief(papers)
    extraction = brief["study_extractions"][0]
    signals = {signal["category"]: signal for signal in extraction["signals"]}

    assert extraction["paper"]["title"] == papers[0]["title"]
    assert extraction["paper"]["url"] == papers[0]["url"]
    assert "transformer model" in " ".join(signals["Approach"]["evidence"]).lower()
    assert "iemocap dataset" in " ".join(signals["Data"]["evidence"]).lower()
    assert "f1 score" in " ".join(signals["Evaluation"]["evidence"]).lower()
    assert "limitation" in " ".join(signals["Limitations"]["evidence"]).lower()


def test_compare_papers_produces_pairwise_scores_with_lexical_fallback(monkeypatch):
    class PaperRecord:
        def __init__(self, paper_id, title, abstract):
            self.id = paper_id
            self.title = title
            self.abstract = abstract

    def unavailable_model():
        raise RuntimeError("model is not downloaded")

    monkeypatch.setattr("app.services.comparison_service._get_embedding_model", unavailable_model)
    result = compare_papers([
        PaperRecord(1, "Emotion recognition from speech", "A neural model classifies affective state from voice."),
        PaperRecord(2, "Speech-based emotion classification", "A neural system detects affective state from voice."),
    ])

    assert result["method"] == "lexical-fallback"
    assert "not semantic similarity" in result["note"]
    assert len(result["papers"]) == 2
    assert len(result["pairwise"]) == 1
    assert 0.0 <= result["pairwise"][0]["score"] <= 1.0
    assert result["pairwise"][0]["score"] > 0
    assert result["pairwise"][0]["left_evidence"] == "A neural model classifies affective state from voice."
    assert result["pairwise"][0]["right_evidence"] == "A neural system detects affective state from voice."
    assert result["pairwise"][0]["evidence_score"] > 0


def test_compare_papers_uses_local_embedding_vectors_when_available(monkeypatch):
    class PaperRecord:
        def __init__(self, paper_id, title, abstract):
            self.id = paper_id
            self.title = title
            self.abstract = abstract

    class Vector:
        def __init__(self, values):
            self.values = values

        def tolist(self):
            return self.values

    class Model:
        def embed(self, texts):
            assert len(texts) == 4
            return iter([
                Vector([1.0, 0.0]),
                Vector([0.8, 0.6]),
                Vector([1.0, 0.0]),
                Vector([0.8, 0.6]),
            ])

    monkeypatch.setattr("app.services.comparison_service._get_embedding_model", lambda: Model())
    result = compare_papers([
        PaperRecord(1, "Speech affect", "Detect affect in voice"),
        PaperRecord(2, "Voice emotion", "Classify emotion in speech"),
    ])

    assert result["method"] == "local-semantic-embeddings"
    assert result["pairwise"][0]["score"] == 0.8
    assert result["pairwise"][0]["left_evidence"] == "Detect affect in voice"
    assert result["pairwise"][0]["right_evidence"] == "Classify emotion in speech"
    assert result["pairwise"][0]["evidence_score"] == 0.8
    assert "evidence quality" in result["note"]


def test_compare_endpoint_only_accepts_current_users_saved_papers(monkeypatch):
    email = f"{uuid4().hex[:8]}@example.com"
    password = "Password123!"
    client.post(
        "/api/auth/register",
        json={"name": "Compare User", "email": email, "password": password},
    )
    token = client.post("/api/auth/login", json={"email": email, "password": password}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    saved_ids = []
    for title, abstract in [
        ("Speech emotion recognition", "A neural model detects affect from speech."),
        ("Voice affect classification", "An approach identifies emotion from speech audio."),
    ]:
        response = client.post(
            "/api/library/save-paper",
            json={"title": title, "abstract": abstract, "source": "Crossref"},
            headers=headers,
        )
        saved_ids.append(response.json()["id"])

    def unavailable_model():
        raise RuntimeError("model is not downloaded")

    monkeypatch.setattr("app.services.comparison_service._get_embedding_model", unavailable_model)
    response = client.post("/api/compare", json={"paper_ids": saved_ids}, headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["method"] == "lexical-fallback"
    assert len(payload["pairwise"]) == 1
    assert payload["pairwise"][0]["left_evidence"] == "A neural model detects affect from speech."
    assert payload["pairwise"][0]["right_evidence"] == "An approach identifies emotion from speech audio."
    assert client.post("/api/compare", json={"paper_ids": [saved_ids[0], 999999]}, headers=headers).status_code == 404
    assert client.post("/api/compare", json={"paper_ids": [saved_ids[0]]}, headers=headers).status_code == 422
