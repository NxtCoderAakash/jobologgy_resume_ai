"use client";

/**
 * Résumé Analyzer — score-only feature. Upload/paste a résumé + a job
 * description, get an ATS fit score, keyword match, strengths, gaps, and
 * recommendations. Nothing is generated or stored.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { scoreResume } from "@/lib/analyzerApi";
import { setHandoff } from "@/lib/handoff";
import type { AnalyzerResult } from "@/types/analyzer";
import NavBar from "@/components/NavBar";
import FileDropzone from "@/components/FileDropzone";
import AnalyzerReport from "@/components/AnalyzerReport";
import LoadingProgress from "@/components/LoadingProgress";
import ScanningPreview from "@/components/ScanningPreview";
import NoJdDialog from "@/components/NoJdDialog";

const SCORING_MESSAGES = [
  "Reading your résumé…",
  "Pulling the key skills out of the job description…",
  "Matching your experience against the role…",
  "Checking keyword coverage for ATS systems…",
  "Scoring formatting and parseability…",
  "Weighing quantified achievements…",
  "Writing your strengths and gaps…",
  "Putting together specific recommendations…",
];

export default function AnalyzerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [usePaste, setUsePaste] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzerResult | null>(null);
  // Holds the API response during the loader's completion animation.
  const [pending, setPending] = useState<AnalyzerResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const jdRef = useRef<HTMLTextAreaElement>(null);

  // No-JD "general scan" consent flow.
  const [showNoJd, setShowNoJd] = useState(false);
  const [lastRunGeneral, setLastRunGeneral] = useState(false);

  // Route guard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setReady(true);
    });
  }, [router]);

  // Scroll to the results when they land, and to the progress panel while waiting.
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);
  useEffect(() => {
    if (busy) loadingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [busy]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!usePaste && !file) {
      setError("Upload a résumé file, or switch to pasting text.");
      return;
    }
    if (usePaste && resumeText.trim().length < 30) {
      setError("Please paste your résumé text.");
      return;
    }
    const jd = jobDescription.trim();
    if (jd.length === 0) {
      // No JD: ask consent for a general market-standard scan instead.
      setShowNoJd(true);
      return;
    }
    if (jd.length < 20) {
      setError("Please paste a job description (at least a few sentences).");
      return;
    }

    await runScore();
  }

  /** Fire the score request (empty JD = consented general scan). */
  async function runScore() {
    setShowNoJd(false);
    setLastRunGeneral(jobDescription.trim().length === 0);
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace("/login");
        return;
      }
      const res = await scoreResume({
        jobDescription,
        file: usePaste ? null : file,
        resumeText: usePaste ? resumeText : undefined,
        token,
      });
      // Don't reveal yet — let the loader complete to 100% first.
      setPending(res);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen">
        <NavBar />
        <p className="mt-20 text-center text-ink-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-extrabold text-ink-900">Résumé Analyzer</h1>
        <p className="mt-1 text-ink-500">
          Check how well your résumé fits a job — get an ATS score, keyword match, and
          specific advice. Your résumé is scored as-is; nothing is rewritten or stored.
        </p>

        <form onSubmit={onSubmit} className="mt-8">
          {/* Inputs — collapse to a compact summary while scanning to free up space. */}
          {!busy && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-ink-900">Your résumé</h2>
                  <button
                    type="button"
                    onClick={() => setUsePaste((v) => !v)}
                    className="text-sm font-semibold text-brand-600 hover:underline"
                  >
                    {usePaste ? "Upload a file instead" : "Paste text instead"}
                  </button>
                </div>
                {usePaste ? (
                  <textarea
                    className="input min-h-[220px] resize-y"
                    placeholder="Paste your current résumé text here…"
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                ) : (
                  <FileDropzone file={file} onFile={setFile} />
                )}
              </div>

              <div className="card">
                <h2 className="mb-3 text-lg font-bold text-ink-900">
                  Job description{" "}
                  <span className="text-sm font-medium text-ink-500">(optional)</span>
                </h2>
                <textarea
                  ref={jdRef}
                  className="input min-h-[220px] resize-y"
                  placeholder="Paste the full job description you're targeting… or leave empty for a general market-standard scan."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && !busy && (
            <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {!busy && (
            <button type="submit" className="btn-primary mt-6">
              Score my résumé →
            </button>
          )}

          {busy && (
            <div ref={loadingRef} className="scroll-mt-24">
              {/* Compact summary of what's being scanned */}
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
                <span className="text-sm font-semibold text-ink-900">
                  📄 {usePaste ? "Pasted résumé" : file?.name || "Your résumé"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-sm text-ink-700">
                  {lastRunGeneral
                    ? "General market-standard scan"
                    : "Scored against your job description"}
                </span>
              </div>
              {/* Scan row: fills the width on wide screens, wraps on small */}
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <div className="md:w-2/5 lg:w-1/3">
                  <ScanningPreview
                    file={usePaste ? null : file}
                    resumeText={usePaste ? resumeText : undefined}
                  />
                </div>
                <div className="flex-1">
                  <LoadingProgress
                    title={
                      lastRunGeneral
                        ? "Scoring your résumé against market standards…"
                        : "Scoring your résumé against the job…"
                    }
                    expectedSeconds={15}
                    messages={SCORING_MESSAGES}
                    done={!!pending}
                    doneMessage="Score ready — here are your results…"
                    onDone={() => {
                      setResult(pending);
                      setPending(null);
                      setBusy(false);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </form>

        {result && (
          <div ref={resultRef} className="mt-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl font-extrabold text-ink-900">Your score</h2>
            <AnalyzerReport result={result} generalScan={lastRunGeneral} />

            {/* Hand-off to the makers */}
            <div className="card mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <p className="text-sm text-ink-700">
                Want to act on this? Let the <strong>Optimizer</strong> rewrite it for this job,
                or fine-tune it yourself in <strong>Résumé Studio</strong>.
              </p>
              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // Carry this run's inputs AND its score over — the Optimizer
                    // arrives pre-filled and can reuse this score as the "before".
                    setHandoff({
                      file: usePaste ? null : file,
                      resumeText: usePaste ? resumeText : "",
                      jobDescription,
                      priorScore: result,
                    });
                    router.push("/app");
                  }}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  Optimize it →
                </button>
                <Link href="/builder" className="btn-ghost px-4 py-2 text-sm">
                  Edit in Studio
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <NoJdDialog
        open={showNoJd}
        onProceed={runScore}
        onAddJd={() => {
          setShowNoJd(false);
          jdRef.current?.focus();
        }}
      />
    </main>
  );
}
