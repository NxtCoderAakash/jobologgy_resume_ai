/** Résumé Analyzer types — mirrors backend/src/types/analyzer.ts. */

export interface Dimension {
  score: number;
  comment: string;
}

export interface AnalyzerResult {
  atsScore: number;
  verdict: string;
  summary: string;
  scoreBreakdown: {
    keywordMatch: Dimension;
    relevanceToJD: Dimension;
    formatting: Dimension;
    impactMetrics: Dimension;
  };
  keywordAnalysis: {
    jdKeywords: string[];
    matched: string[];
    missing: string[];
  };
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}
