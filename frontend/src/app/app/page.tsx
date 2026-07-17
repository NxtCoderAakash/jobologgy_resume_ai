"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { analyzeResume } from "@/lib/api";
import { takeHandoff } from "@/lib/handoff";
import type { AnalyzeResult } from "@/types/analysis";
import type { AnalyzerResult } from "@/types/analyzer";
import NavBar from "@/components/NavBar";
import FileDropzone from "@/components/FileDropzone";
import AnalysisReport from "@/components/AnalysisReport";
import LoadingProgress from "@/components/LoadingProgress";

const OPTIMIZING_MESSAGES = [
  "Reading your résumé…",
  "Extracting the job's key requirements…",
  "Scoring your current résumé against the role…",
  "Rewriting bullets with stronger action verbs…",
  "Weaving missing keywords into your real experience…",
  "Re-scoring the optimized version…",
  "Laying out your new ATS-safe CV…",
  "Rendering your two PDFs…",
  "Uploading your documents securely…",
];

export default function WorkspacePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [usePaste, setUsePaste] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  // Holds the API response during the loader's completion animation.
  const [pending, setPending] = useState<AnalyzeResult | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  // Snapshot of the Analyzer hand-off: its score plus the exact inputs it was
  // computed for. We only reuse the score as "before" if the user hasn't since
  // changed the résumé or JD — otherwise it would be stale and wrong.
  const handoffRef = useRef<{
    resumeText: string;
    jobDescription: string;
    file: File | null;
    priorScore: AnalyzerResult | null;
  } | null>(null);

  // "Add skills from the JD" dialog state.
  const [showSkillDialog, setShowSkillDialog] = useState(false);
  const [offeredSkills, setOfferedSkills] = useState<string[]>([]);
  const [checkedSkills, setCheckedSkills] = useState<Record<string, boolean>>({});
  const [extraSkills, setExtraSkills] = useState("");

  // Scroll the results into view the moment they're revealed.
  const resultRef = useRef<HTMLDivElement>(null);

  // Route guard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setReady(true);
    });
  }, [router]);

  // As soon as results land, scroll down to them (mirrors the Analyzer).
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  // Pre-fill when arriving from the Analyzer's "Optimize it" hand-off.
  useEffect(() => {
    const h = takeHandoff();
    if (!h) return;
    if (h.jobDescription) setJobDescription(h.jobDescription);
    if (h.file) {
      setFile(h.file);
      setUsePaste(false);
    } else if (h.resumeText) {
      setResumeText(h.resumeText);
      setUsePaste(true);
    }
    if (h.jobDescription || h.file || h.resumeText) setPrefilled(true);
    handoffRef.current = {
      resumeText: h.resumeText ?? "",
      jobDescription: h.jobDescription ?? "",
      file: h.file ?? null,
      priorScore: h.priorScore ?? null,
    };
  }, []);

  /** Reuse the Analyzer's score only if the résumé + JD are unchanged since it ran. */
  function reusablePriorScore(): AnalyzerResult | null {
    const src = handoffRef.current;
    if (!src?.priorScore) return null;
    if (jobDescription !== src.jobDescription) return null;
    const sameResume = usePaste
      ? resumeText === src.resumeText
      : file != null && file === src.file;
    return sameResume ? src.priorScore : null;
  }

  /** JD skills the Analyzer found missing from this exact résumé (offered in the dialog). */
  function missingSkillsToOffer(): string[] {
    return reusablePriorScore()?.keywordAnalysis.missing ?? [];
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (jobDescription.trim().length < 20) {
      setError("Please paste a job description (at least a few sentences).");
      return;
    }
    if (!usePaste && !file) {
      setError("Upload a résumé file, or switch to pasting text.");
      return;
    }
    if (usePaste && resumeText.trim().length < 30) {
      setError("Please paste your résumé text.");
      return;
    }

    // If the JD wants skills this résumé doesn't show, ask the user which they
    // genuinely have before we build the CV — never invent them silently.
    const missing = missingSkillsToOffer();
    if (missing.length) {
      setOfferedSkills(missing);
      setCheckedSkills({});
      setExtraSkills("");
      setShowSkillDialog(true);
      return;
    }
    await runOptimize([]);
  }

  /** Fire the optimize request, optionally adding user-confirmed skills. */
  async function runOptimize(confirmedSkills: string[]) {
    setShowSkillDialog(false);
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace("/login");
        return;
      }
      const res = await analyzeResume({
        jobDescription,
        file: usePaste ? null : file,
        resumeText: usePaste ? resumeText : undefined,
        token,
        priorBeforeScore: reusablePriorScore(),
        confirmedSkills,
      });
      // Don't reveal yet — let the loader complete to 100% first.
      setPending(res);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  /** Collect the checked JD skills + any free-text extras, then optimize. */
  function confirmSkillsAndOptimize() {
    const checked = offeredSkills.filter((s) => checkedSkills[s]);
    const extras = extraSkills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    runOptimize([...checked, ...extras]);
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
        <h1 className="text-3xl font-extrabold text-ink-900">Résumé Optimizer</h1>
        <p className="mt-1 text-ink-500">
          Upload your CV and a job description — get an ATS-optimized résumé, a before/after
          score, and a report of every improvement.
        </p>

        {prefilled && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
            ✓ Pre-filled from your Analyzer run — just hit “Optimize my résumé”.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Résumé input */}
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

          {/* Job description */}
          <div className="card">
            <h2 className="mb-3 text-lg font-bold text-ink-900">Job description</h2>
            <textarea
              className="input min-h-[220px] resize-y"
              placeholder="Paste the full job description you're applying to…"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div className="lg:col-span-2">
            {error && (
              <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? (
                <>
                  <span
                    aria-hidden
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  Optimizing your résumé…
                </>
              ) : (
                "Optimize my résumé →"
              )}
            </button>

            {busy && (
              <div className="mt-6">
                <LoadingProgress
                  title="Building your optimized résumé…"
                  expectedSeconds={25}
                  messages={OPTIMIZING_MESSAGES}
                  done={!!pending}
                  doneMessage="Your optimized résumé is ready…"
                  onDone={() => {
                    setResult(pending);
                    setPending(null);
                    setBusy(false);
                  }}
                />
              </div>
            )}
          </div>
        </form>

        {result && (
          <div ref={resultRef} className="mt-12 scroll-mt-6">
            <h2 className="mb-4 text-2xl font-extrabold text-ink-900">Your results</h2>
            <AnalysisReport result={result} />
          </div>
        )}
      </div>

      {showSkillDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skill-dialog-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card">
            <h3 id="skill-dialog-title" className="text-xl font-extrabold text-ink-900">
              Add skills the job asks for?
            </h3>
            <p className="mt-2 text-sm text-ink-500">
              The job description mentions these skills your résumé doesn’t show yet. Tick any you
              genuinely have — we’ll weave them into your optimized CV. We won’t add skills you
              don’t confirm.
            </p>

            <div className="mt-4 space-y-2">
              {offeredSkills.map((s) => (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={!!checkedSkills[s]}
                    onChange={(e) =>
                      setCheckedSkills((prev) => ({ ...prev, [s]: e.target.checked }))
                    }
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span className="text-sm font-medium text-ink-700">{s}</span>
                </label>
              ))}
            </div>

            <div className="mt-4">
              <label
                htmlFor="extra-skills"
                className="text-sm font-semibold text-ink-700"
              >
                Other skills from the job description you have (optional)
              </label>
              <input
                id="extra-skills"
                className="input mt-1"
                placeholder="e.g. Docker, GraphQL"
                value={extraSkills}
                onChange={(e) => setExtraSkills(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-500">
                Comma-separated. Only add skills you can honestly back up in an interview.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-ghost" onClick={() => runOptimize([])}>
                Skip — don’t add any
              </button>
              <button type="button" className="btn-primary" onClick={confirmSkillsAndOptimize}>
                Add selected &amp; optimize →
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
