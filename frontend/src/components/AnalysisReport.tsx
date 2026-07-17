"use client";

import type { AnalyzeResult } from "@/types/analysis";
import ScoreComparison from "./ScoreComparison";
import KeywordDiff from "./KeywordDiff";
import ImprovementList from "./ImprovementList";
import DownloadCard from "./DownloadCard";

export default function AnalysisReport({
  result,
  cvStyle,
  photoDataUrl,
}: {
  result: AnalyzeResult;
  cvStyle?: "standard" | "creative";
  photoDataUrl?: string | null;
}) {
  return (
    <div className="space-y-6">
      <DownloadCard result={result} cvStyle={cvStyle} photoDataUrl={photoDataUrl} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ScoreComparison analysis={result.analysis} />
        <KeywordDiff analysis={result.analysis} />
      </div>
      <ImprovementList analysis={result.analysis} />
    </div>
  );
}
