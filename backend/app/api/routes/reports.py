from __future__ import annotations

import csv
import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.paper import ResearchPaper, SavedPaper
from app.models.report import Report
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])

REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage", "reports")


class GenerateReportPayload(BaseModel):
    report_type: str
    title: str
    format: str = "pdf"
    paper_ids: list[int] | None = None

    model_config = {"json_schema_extra": {"example": {"report_type": "library_summary", "title": "My Report", "format": "pdf"}}}


def ensure_reports_dir() -> str:
    os.makedirs(REPORTS_DIR, exist_ok=True)
    return REPORTS_DIR


@router.get("")
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    reports = (
        db.query(Report)
        .filter_by(user_id=current_user.id)
        .order_by(Report.created_at.desc())
        .all()
    )
    return [_report_out(r) for r in reports]


@router.post("/generate")
def generate_report(
    payload: GenerateReportPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if payload.format not in ("pdf", "csv", "json", "docx", "bibtex"):
        raise HTTPException(status_code=400, detail="Unsupported format. Use pdf, csv, json, docx, or bibtex.")

    # Fetch papers
    papers_query = (
        db.query(ResearchPaper)
        .join(SavedPaper, SavedPaper.paper_id == ResearchPaper.id)
        .filter(SavedPaper.user_id == current_user.id)
    )
    if payload.paper_ids:
        papers_query = papers_query.filter(ResearchPaper.id.in_(payload.paper_ids))
    papers = papers_query.all()

    reports_dir = ensure_reports_dir()
    ext = "bib" if payload.format == "bibtex" else payload.format
    filename = f"report_{current_user.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{ext}"
    file_path = os.path.join(reports_dir, filename)

    try:
        if payload.format == "json":
            _generate_json(file_path, payload, papers)
        elif payload.format == "csv":
            _generate_csv(file_path, payload, papers)
        elif payload.format == "pdf":
            _generate_pdf(file_path, payload, papers)
        elif payload.format == "docx":
            _generate_docx(file_path, payload, papers)
        elif payload.format == "bibtex":
            _generate_bibtex(file_path, payload, papers)
        file_status = "completed"
    except Exception as exc:
        file_status = "failed"
        file_path = None
        filename = None

    report = Report(
        user_id=current_user.id,
        title=payload.title,
        report_type=payload.report_type,
        format=payload.format,
        status=file_status,
        file_path=file_path,
        created_at=datetime.utcnow(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return _report_out(report)


@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    report = db.query(Report).filter_by(id=report_id, user_id=current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != "completed" or not report.file_path:
        raise HTTPException(status_code=400, detail="Report is not ready for download")
    if not os.path.isfile(report.file_path):
        raise HTTPException(status_code=404, detail="Report file not found on disk")

    media_types = {
        "pdf": "application/pdf",
        "csv": "text/csv",
        "json": "application/json",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "bibtex": "application/x-bibtex",
    }
    return FileResponse(
        report.file_path,
        media_type=media_types.get(report.format, "application/octet-stream"),
        filename=f"{report.title.replace(' ', '_')}.{report.format}",
    )


def _generate_json(path: str, payload: GenerateReportPayload, papers: list) -> None:
    data = {
        "report_title": payload.title,
        "report_type": payload.report_type,
        "generated_at": datetime.utcnow().isoformat(),
        "total_papers": len(papers),
        "papers": [
            {
                "id": p.id,
                "title": p.title,
                "authors": p.authors,
                "abstract": p.abstract,
                "source": p.source,
                "publication_year": p.publication_year,
                "doi": p.doi,
                "url": p.url,
            }
            for p in papers
        ],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _generate_csv(path: str, payload: GenerateReportPayload, papers: list) -> None:
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["Title", "Authors", "Source", "Year", "DOI", "URL", "Abstract"])
        for p in papers:
            writer.writerow([
                p.title, p.authors or "", p.source,
                p.publication_year or "", p.doi or "", p.url or "",
                (p.abstract or "")[:500],
            ])


def _generate_pdf(path: str, payload: GenerateReportPayload, papers: list) -> None:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
        from reportlab.lib import colors

        doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph(payload.title, styles["Title"]))
        story.append(Spacer(1, 0.3*cm))
        story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC", styles["Normal"]))
        story.append(Paragraph(f"Type: {payload.report_type} | Papers: {len(papers)}", styles["Normal"]))
        story.append(Spacer(1, 0.5*cm))

        for i, p in enumerate(papers, 1):
            story.append(Paragraph(f"{i}. {p.title}", styles["Heading2"]))
            if p.authors:
                story.append(Paragraph(f"Authors: {p.authors}", styles["Normal"]))
            meta = f"Source: {p.source}"
            if p.publication_year:
                meta += f" | Year: {p.publication_year}"
            if p.doi:
                meta += f" | DOI: {p.doi}"
            story.append(Paragraph(meta, styles["Normal"]))
            if p.url:
                story.append(Paragraph(f"URL: {p.url}", styles["Normal"]))
            if p.abstract:
                story.append(Spacer(1, 0.2*cm))
                story.append(Paragraph(p.abstract[:800], styles["Normal"]))
            story.append(Spacer(1, 0.4*cm))

        doc.build(story)
    except ImportError:
        # Fall back to JSON if reportlab not installed
        _generate_json(path.replace(".pdf", ".json"), payload, papers)
        raise RuntimeError("reportlab not installed, generated JSON instead")


def _generate_docx(path: str, payload: GenerateReportPayload, papers: list) -> None:
    try:
        from docx import Document as DocxDocument
        from docx.shared import Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        doc = DocxDocument()

        # Title
        title_para = doc.add_heading(payload.title, level=0)
        title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Metadata
        meta = doc.add_paragraph()
        meta.add_run(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC  |  "
                     f"Type: {payload.report_type}  |  Papers: {len(papers)}")
        meta.style.font.size = Pt(10)
        meta.style.font.color.rgb = RGBColor(0x64, 0x74, 0x8b)

        doc.add_paragraph()

        for i, p in enumerate(papers, 1):
            heading = doc.add_heading(f"{i}. {p.title}", level=2)

            info_parts = [f"Source: {p.source}"]
            if p.publication_year:
                info_parts.append(f"Year: {p.publication_year}")
            if p.doi:
                info_parts.append(f"DOI: {p.doi}")
            if p.authors:
                info_parts.append(f"Authors: {p.authors}")

            info_para = doc.add_paragraph("  |  ".join(info_parts))
            info_para.style.font.size = Pt(9)

            if p.url:
                url_para = doc.add_paragraph(f"URL: {p.url}")
                url_para.style.font.size = Pt(9)

            if p.abstract:
                doc.add_paragraph(p.abstract[:1000])

            doc.add_paragraph()

        doc.save(path)
    except ImportError:
        raise RuntimeError("python-docx is not installed. Run: pip install python-docx")


def _generate_bibtex(path: str, payload: GenerateReportPayload, papers: list) -> None:
    import re

    def make_key(paper) -> str:
        authors_raw = paper.authors or "Unknown"
        first_author = re.split(r"[,;]", authors_raw)[0].strip()
        last = first_author.split()[-1] if first_author else "Unknown"
        last = re.sub(r"[^a-zA-Z]", "", last)
        year = str(paper.publication_year) if paper.publication_year else "XXXX"
        title_word = re.sub(r"[^a-zA-Z]", "", (paper.title or "").split()[0]) if paper.title else "Untitled"
        return f"{last}{year}{title_word}"

    lines = [f"% {payload.title}", f"% Generated: {datetime.utcnow().isoformat()}", ""]
    used_keys: set[str] = set()

    for p in papers:
        raw_key = make_key(p)
        key = raw_key
        suffix = 2
        while key in used_keys:
            key = f"{raw_key}{suffix}"
            suffix += 1
        used_keys.add(key)

        entry_type = "article" if p.doi else "misc"
        lines.append(f"@{entry_type}{{{key},")
        if p.title:
            lines.append(f"  title = {{{p.title}}},")
        if p.authors:
            lines.append(f"  author = {{{p.authors}}},")
        if p.publication_year:
            lines.append(f"  year = {{{p.publication_year}}},")
        if p.doi:
            lines.append(f"  doi = {{{p.doi}}},")
        if p.url:
            lines.append(f"  url = {{{p.url}}},")
        if p.source:
            lines.append(f"  note = {{Source: {p.source}}},")
        lines.append("}")
        lines.append("")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def _report_out(r: Report) -> dict:
    return {
        "id": r.id,
        "title": r.title,
        "report_type": r.report_type,
        "format": r.format,
        "status": r.status,
        "created_at": r.created_at.isoformat(),
        "file_path": r.file_path,
    }
