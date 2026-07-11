"use client";

import type { AnalyzeResult } from "@/types/analysis";
import ScoreComparison from "./ScoreComparison";
import KeywordDiff from "./KeywordDiff";
import ImprovementList from "./ImprovementList";
import DownloadCard from "./DownloadCard";

export default function AnalysisReport({ result }: { result: AnalyzeResult }) {
  return (
    <div className="space-y-6">
      <DownloadCard result={result} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ScoreComparison analysis={result.analysis} />
        <KeywordDiff analysis={result.analysis} />
      </div>
      <ImprovementList analysis={result.analysis} />
    </div>
  );
}
