"use client";

import type { AnalyzeResult } from "@/types/analysis";

export default function DownloadCard({ result }: { result: AnalyzeResult }) {
  const items = [
    {
      title: "Optimized CV",
      desc: "Your ATS-ready, tailored résumé.",
      url: result.cvPdfUrl,
      icon: "📄",
    },
    {
      title: "Improvement report",
      desc: "Scores, keywords & what changed.",
      url: result.reportPdfUrl,
      icon: "📊",
    },
  ];

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-ink-900">Download your PDFs</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex flex-col justify-between rounded-xl border border-slate-200 p-4"
          >
            <div>
              <div className="text-2xl">{it.icon}</div>
              <h3 className="mt-2 font-bold text-ink-900">{it.title}</h3>
              <p className="text-sm text-ink-500">{it.desc}</p>
            </div>
            {it.url ? (
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4 w-full"
              >
                Download PDF
              </a>
            ) : (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                PDF not stored — configure Supabase storage to enable downloads.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
