export interface User {
  id: number
  name: string
  email: string
}

export interface Paper {
  id?: number
  doi?: string | null
  title: string
  authors?: string | null
  abstract?: string | null
  source: string
  url?: string | null
  publication_year?: number | null
  external_id?: string | null
}

export interface SearchResponse {
  results: Paper[]
  query: string
  count: number
}

export interface DashboardData {
  welcome: string
  papers_collected: number
  saved_papers: number
  papers_analyzed: number
  research_activity: string
}

export interface KeywordEvidence {
  term: string
  paper_count: number
  papers: { title: string; source: string; url?: string | null; publication_year?: number | null }[]
}

export interface InsightSummary {
  headline: string
  overview: string
  keywords: string[]
  keyword_evidence: KeywordEvidence[]
  paper_count: number
  source_count: number
  recommendations: string[]
  source_breakdown: { source: string; count: number }[]
  trend_focus: string
  method_focus: string[]
  research_gaps: string[]
}

export interface PublicationEntry {
  year: number
  count: number
}

export interface ThemeEvidence {
  name: string
  paper_count: number
  evidence_strength: string
  publication_momentum: string
  publication_activity: PublicationEntry[]
  sources: string[]
  papers: { title: string; source: string; url?: string | null; publication_year?: number | null }[]
}

export interface MethodCoverage {
  name: string
  paper_count: number
  papers: { title: string; source: string; url?: string | null; publication_year?: number | null }[]
}

export interface StudySignal {
  category: string
  evidence: string[]
}

export interface StudyExtraction {
  paper: { title: string; source: string; url?: string | null; publication_year?: number | null }
  signals: StudySignal[]
}

export interface BriefSummary {
  title: string
  summary: string
  themes: ThemeEvidence[]
  method_coverage: MethodCoverage[]
  study_extractions: StudyExtraction[]
  evidence_strength: string
  next_actions: string[]
  publication_activity: PublicationEntry[]
  publication_momentum: string
  momentum_comparison: {
    latest_year: number
    latest_count: number
    previous_year: number
    previous_count: number
  } | null
}

export interface SemanticPaper {
  paper_id: number
  similarity: number
}

export interface PairwiseScore {
  left_paper_id: number
  right_paper_id: number
  score: number
  left_evidence?: string | null
  right_evidence?: string | null
  evidence_score?: number | null
}

export interface SemanticComparison {
  note: string
  method: string
  papers: SemanticPaper[]
  pairwise: PairwiseScore[]
}

export interface AnalyticsData {
  publications_by_year: PublicationEntry[]
  domain_distribution: { domain: string; count: number }[]
  top_keywords: { keyword: string; count: number }[]
  source_distribution: { source: string; count: number }[]
  total_papers: number
  date_range: { min_year: number | null; max_year: number | null }
}

export interface UploadedDocument {
  id: number
  filename: string
  original_filename: string
  status: string
  file_size: number
  created_at: string
  paper_id?: number | null
  extracted_title?: string | null
  extracted_authors?: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  conversation_id?: number
  created_at: string
}

export interface Citation {
  paper_id: number
  title: string
  authors?: string | null
  year?: number | null
  url?: string | null
  excerpt?: string | null
}

export interface Conversation {
  id: number
  title: string
  created_at: string
  message_count: number
}

export interface SavedSearch {
  id: number
  query: string
  mode: string
  result_count: number | null
  created_at: string
}

export interface PaperTag {
  paper_id: number
  tag: string
}

export interface CollectionAnalysis {
  collection: {
    id: number
    name: string
    description?: string | null
    paper_count: number
    created_at: string
    updated_at: string
  }
  total_papers: number
  top_keywords: { keyword: string; count: number }[]
  domain_distribution: { domain: string; count: number }[]
  publications_by_year: { year: number; count: number }[]
  summary: string
}
