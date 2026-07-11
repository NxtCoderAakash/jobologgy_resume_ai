export interface BeforeAfter {
  before: number;
  after: number;
}

export interface Analysis {
  atsScoreBefore: number;
  atsScoreAfter: number;
  scoreBreakdown: {
    keywordMatch: BeforeAfter;
    relevanceToJD: BeforeAfter;
    formatting: BeforeAfter;
    impactMetrics: BeforeAfter;
  };
  keywordAnalysis: {
    jdKeywords: string[];
    matchedBefore: string[];
    missingBefore: string[];
    addedInNew: string[];
  };
  improvements: { area: string; before: string; after: string; reason: string }[];
  summaryOfChanges: string;
  rewrittenCV: {
    fullName: string;
    title: string;
    contact: { email?: string; phone?: string; location?: string; links?: string[] };
    summary: string;
    skills: string[];
    experience: { role: string; company: string; dates: string; bullets: string[] }[];
    education: { degree: string; institution: string; dates: string }[];
    projects?: { name: string; description: string; bullets?: string[] }[];
    certifications?: string[];
  };
}

export interface AnalyzeResult {
  jobId: string | null;
  analysis: Analysis;
  cvPdfUrl: string | null;
  reportPdfUrl: string | null;
}
