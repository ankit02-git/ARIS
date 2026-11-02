import httpx

from app.services.search_service import search_academic_papers


def test_search_academic_papers_deduplicates_and_normalizes(monkeypatch):
    def fake_get(url: str, params=None, timeout=20):
        request = httpx.Request("GET", url)

        if "export.arxiv.org" in url:
            return httpx.Response(
                200,
                request=request,
                text="""
                <feed xmlns="http://www.w3.org/2005/Atom">
                  <entry>
                    <title>Emotion Recognition with Deep Learning</title>
                    <summary>Using CNNs for affective computing.</summary>
                    <published>2024-01-01T00:00:00Z</published>
                    <author><name>Alice Brown</name></author>
                    <author><name>Bob Smith</name></author>
                    <link rel="alternate" href="https://arxiv.org/abs/2401.00001v1"/>
                  </entry>
                </feed>
                """,
            )

        if "api.crossref.org" in url:
            return httpx.Response(
                200,
                request=request,
                json={
                    "message": {
                        "items": [
                            {
                                "title": ["Emotion Recognition with Deep Learning"],
                                "author": [{"given": "Alice", "family": "Brown"}],
                                "abstract": "<jats:p>Deep learning for emotion recognition.</jats:p>",
                                "issued": {"date-parts": [[2024, 1, 1]]},
                                "DOI": "10.1000/example",
                                "URL": "https://example.org/article",
                                "container-title": ["Affective Computing Journal"],
                            }
                        ]
                    }
                },
            )

        if "semanticscholar.org" in url:
            return httpx.Response(
                200,
                request=request,
                json={
                    "data": [
                        {
                            "title": "Emotion Recognition with Deep Learning",
                            "authors": [{"name": "Alice Brown"}, {"name": "Bob Smith"}],
                            "abstract": "Deep learning for emotion recognition.",
                            "year": 2024,
                            "url": "https://semanticscholar.org/paper123",
                            "externalIds": {"DOI": "10.1000/example"},
                            "venue": "Affective Computing Conference",
                        }
                    ]
                },
            )

        if "eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi" in url:
            return httpx.Response(
                200,
                request=request,
                text="<eSearchResult><IdList><Id>123</Id></IdList></eSearchResult>",
            )

        if "eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi" in url:
            return httpx.Response(
                200,
                request=request,
                text="""
                <eSummaryResult>
                  <DocSum>
                    <Id>123</Id>
                    <Item Name="Title">Emotion recognition with deep learning</Item>
                    <Item Name="PubDate">2024 Jan</Item>
                    <Item Name="AuthorList">Alice Brown</Item>
                  </DocSum>
                </eSummaryResult>
                """,
            )

        raise AssertionError(f"Unexpected URL requested: {url}")

    monkeypatch.setattr("app.integrations.arxiv_adapter.httpx.get", fake_get)
    monkeypatch.setattr("app.integrations.crossref_adapter.httpx.get", fake_get)
    monkeypatch.setattr("app.integrations.semantic_scholar_adapter.httpx.get", fake_get)
    monkeypatch.setattr("app.integrations.pubmed_adapter.httpx.get", fake_get)

    results = search_academic_papers("emotion recognition using deep learning", limit=5)

    assert len(results) >= 1
    assert all("title" in item for item in results)
    assert all(item["source"] for item in results)
    assert len({(item["title"], item["source"]) for item in results}) >= 3
