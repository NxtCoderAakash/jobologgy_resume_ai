"use client";

import type { AnalyzeResult } from "@/types/analysis";
import ScoreComparison from "./ScoreComparison";
import KeywordDiff from "./KeywordDiff";
import ImprovementList from "./ImprovementList";
import DownloadCard from "./DownloadCard";
import ScoreDisclaimer from "./ScoreDisclaimer";

export default function AnalysisReport({
  result,
  cvStyle,
  photoDataUrl,
  generalScan = false,
}: {
  result: AnalyzeResult;
  cvStyle?: "standard" | "creative";
  photoDataUrl?: string | null;
  /** True when optimized without a JD (General mode) — sets the disclaimer copy. */
  generalScan?: boolean;
}) {
  return (
    <div className="space-y-6">
      <DownloadCard result={result} cvStyle={cvStyle} photoDataUrl={photoDataUrl} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScoreComparison analysis={result.analysis} />
        <KeywordDiff analysis={result.analysis} />
      </div>
      <ImprovementList analysis={result.analysis} />

      {/* Honest footer — shown on every result, both modes (PO C2 / INV-10). */}
      <ScoreDisclaimer mode={generalScan ? "general" : "jd"} ceiling={generalScan ? 95 : 90} />
    </div>
  );
}
