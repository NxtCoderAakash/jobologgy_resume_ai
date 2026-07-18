"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { analyzeResume } from "@/lib/api";
import { takeHandoff } from "@/lib/handoff";
import { ATS_SYSTEMS, type AtsSystem } from "@/lib/atsSystems";
import type { AnalyzeResult } from "@/types/analysis";
import type { AnalyzerResult } from "@/types/analyzer";
import NavBar from "@/components/NavBar";
import FileDropzone from "@/components/FileDropzone";
import AnalysisReport from "@/components/AnalysisReport";
import LoadingProgress from "@/components/LoadingProgress";
import ScanningPreview from "@/components/ScanningPreview";
import NoJdDialog from "@/components/NoJdDialog";
import ResumeStylePreview from "@/components/ResumeStylePreview";

/** Read an image file and downscale it to a small square-ish JPEG data URL. */
async function readResizedPhoto(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read failed"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("decode failed"));
    im.src = dataUrl;
  });
  const MAX = 400;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

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

  // Pre-optimize wizard state (style → ATS targeting → optional JD skills), so
  // each screen asks exactly one question.
  const [showSkillDialog, setShowSkillDialog] = useState(false);
  const [dialogStep, setDialogStep] = useState<1 | 2 | 3>(1);
  const [offeredSkills, setOfferedSkills] = useState<string[]>([]);
  const [checkedSkills, setCheckedSkills] = useState<Record<string, boolean>>({});
  const [extraSkills, setExtraSkills] = useState("");

  // Step 1 — résumé visual style + optional photo (for the "creative" style).
  const [cvStyle, setCvStyle] = useState<"standard" | "creative">("standard");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  // ATS systems the résumé is optimized against.
  const [atsChecked, setAtsChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ATS_SYSTEMS.map((a) => [a.key, a.defaultConsidered])),
  );
  const [customAts, setCustomAts] = useState<string[]>([]);
  const [customAtsInput, setCustomAtsInput] = useState("");
  const [atsInfo, setAtsInfo] = useState<AtsSystem | null>(null); // info dialog target

  // Scroll the results into view the moment they're revealed.
  const resultRef = useRef<HTMLDivElement>(null);
  const jdRef = useRef<HTMLTextAreaElement>(null);

  // No-JD "general scan" consent flow.
  const [showNoJd, setShowNoJd] = useState(false);
  const [lastRunGeneral, setLastRunGeneral] = useState(false);
  // Once results are in, inputs collapse to a summary; "Edit" re-expands them.
  const [editing, setEditing] = useState(false);
  // Abort an in-flight optimize when the user chooses to stop & edit.
  const abortRef = useRef<AbortController | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

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

  /** The ATS systems (built-in ticked + custom) the résumé is optimized against. */
  function selectedAtsNames(): string[] {
    const builtin = ATS_SYSTEMS.filter((a) => atsChecked[a.key]).map((a) => a.name);
    return [...builtin, ...customAts];
  }

  function addCustomAts() {
    const names = customAtsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length) setCustomAts((prev) => [...new Set([...prev, ...names])]);
    setCustomAtsInput("");
  }

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
      // No JD: ask consent for a general market-standard scan first.
      setShowNoJd(true);
      return;
    }
    if (jd.length < 20) {
      setError("Please paste a job description (at least a few sentences).");
      return;
    }

    openPreOptimizeDialog();
  }

  /** The pre-optimize wizard: step 1 = ATS targeting, step 2 = skills confirmation. */
  function openPreOptimizeDialog() {
    setShowNoJd(false);
    setOfferedSkills(missingSkillsToOffer());
    setCheckedSkills({});
    setExtraSkills("");
    setDialogStep(1);
    setShowSkillDialog(true);
  }

  /** Fire the optimize request with the chosen ATS targets and confirmed skills. */
  async function runOptimize(confirmedSkills: string[]) {
    setShowSkillDialog(false);
    setEditing(false);
    setLastRunGeneral(jobDescription.trim().length === 0);
    const controller = new AbortController();
    abortRef.current = controller;
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
        atsSystems: selectedAtsNames(),
        cvStyle,
        photoDataUrl: cvStyle === "creative" ? photoDataUrl : null,
        signal: controller.signal,
      });
      // Don't reveal yet — let the loader complete to 100% first.
      setPending(res);
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // user stopped it on purpose
      setError((err as Error).message);
      setBusy(false);
    }
  }

  /** Abort the in-flight optimize and reopen the inputs for a re-upload. */
  function stopAndEdit() {
    abortRef.current?.abort();
    setConfirmStop(false);
    setPending(null);
    setBusy(false);
    setEditing(true);
  }

  /** Read + downscale the chosen profile photo into a data URL for the creative style. */
  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setPhotoDataUrl(await readResizedPhoto(f));
    } catch {
      setError("Couldn't read that image — try a different photo.");
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
      <div className="px-4 py-10 sm:px-6 lg:px-12">
        <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">Résumé Optimizer</h1>
        <p className="mt-1 text-ink-500">
          Upload your CV and a job description — get an ATS-optimized résumé, a before/after
          score, and a report of every improvement.
        </p>

        {prefilled && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
            ✓ Pre-filled from your Analyzer run — just hit “Optimize my résumé”.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-8">
          {/* After results (and not editing), collapse inputs to a summary bar. */}
          {!busy && result && !editing && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
              <span className="text-sm font-semibold text-ink-900">
                📄 {usePaste ? "Pasted résumé" : file?.name || "Your résumé"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-sm text-ink-700">
                {lastRunGeneral
                  ? "General market-standard optimization"
                  : "Optimized for your job description"}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-ghost ml-auto px-4 py-2 text-sm"
              >
                ✎ Edit &amp; re-optimize
              </button>
            </div>
          )}

          {/* Inputs — collapse to a compact summary while optimizing to free up space. */}
          {!busy && (!result || editing) && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                <h2 className="mb-3 text-lg font-bold text-ink-900">
                  Job description{" "}
                  <span className="text-sm font-medium text-ink-500">(optional)</span>
                </h2>
                <textarea
                  ref={jdRef}
                  className="input min-h-[220px] resize-y"
                  placeholder="Paste the full job description you're applying to… or leave empty for a general market-standard scan."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && !busy && (
            <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {!busy && (!result || editing) && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" className="btn-primary">
                {result ? "Re-optimize my résumé →" : "Optimize my résumé →"}
              </button>
              {result && editing && (
                <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              )}
            </div>
          )}

          {busy && (
            <div className="scroll-mt-6">
              {/* Compact summary of what's being scanned */}
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
                <span className="text-sm font-semibold text-ink-900">
                  📄 {usePaste ? "Pasted résumé" : file?.name || "Your résumé"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-sm text-ink-700">
                  {lastRunGeneral
                    ? "General market-standard optimization"
                    : "Optimizing for your job description"}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmStop(true)}
                  className="btn-ghost ml-auto px-3 py-1.5 text-sm"
                >
                  ✎ Stop &amp; edit
                </button>
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
                        ? "Optimizing against market standards…"
                        : "Building your optimized résumé…"
                    }
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
              </div>
            </div>
          )}
        </form>

        {result && (
          <div ref={resultRef} className="mt-12 scroll-mt-6">
            <h2 className="mb-4 text-2xl font-extrabold text-ink-900">Your results</h2>
            <AnalysisReport
              result={result}
              cvStyle={cvStyle}
              photoDataUrl={cvStyle === "creative" ? photoDataUrl : null}
            />
          </div>
        )}
      </div>

      <NoJdDialog
        open={showNoJd}
        onProceed={openPreOptimizeDialog}
        onAddJd={() => {
          setShowNoJd(false);
          jdRef.current?.focus();
        }}
        onDismiss={() => setShowNoJd(false)}
      />

      {/* Confirm before aborting an in-flight optimize */}
      {confirmStop && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stop-title"
          onClick={() => setConfirmStop(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="stop-title" className="text-xl font-extrabold text-ink-900">
              Stop and edit?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-700">
              This cancels the optimization that&apos;s running now. You&apos;ll lose this in-progress
              result and can upload a different résumé or change the job description before running
              again.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmStop(false)}
              >
                Keep scanning
              </button>
              <button
                type="button"
                onClick={stopAndEdit}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
              >
                Stop &amp; edit
              </button>
            </div>
          </div>
        </div>
      )}

      {showSkillDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="opt-dialog-title"
          onClick={() => setShowSkillDialog(false)}
        >
          <div
            className={`max-h-[88vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-card ${
              dialogStep === 1 ? "max-w-2xl" : "max-w-lg"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="opt-dialog-title" className="text-xl font-extrabold text-ink-900">
                {dialogStep === 1
                  ? "Choose your résumé style"
                  : dialogStep === 2
                    ? "Choose your ATS systems"
                    : "Add skills you have"}
              </h3>
              <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                Step {dialogStep} of {offeredSkills.length > 0 ? 3 : 2}
              </span>
            </div>

            {/* Step 1 — résumé visual style */}
            {dialogStep === 1 && (
              <div className="mt-4">
                <p className="text-xs text-ink-500">
                  Pick a look for your generated CV. Previews below are sample layouts — your own
                  content fills the real résumé.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      key: "standard",
                      title: "Standard",
                      atsTag: "ATS-safe",
                      tagClass: "bg-emerald-100 text-emerald-700",
                      desc: "Clean single-column layout that parses reliably in applicant tracking systems. Best for online job applications.",
                    },
                    {
                      key: "creative",
                      title: "Colourful + photo",
                      atsTag: "Best for humans",
                      tagClass: "bg-fuchsia-100 text-fuchsia-700",
                      desc: "A bold, modern design with your photo. Great for portfolios, networking, or emailing directly to a person.",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => setCvStyle(opt.key)}
                    className={`block w-full rounded-xl border-2 p-3 text-left transition ${
                      cvStyle === opt.key
                        ? "border-brand-600 bg-brand-50"
                        : "border-gray-200 hover:border-brand-300"
                    }`}
                  >
                    <ResumeStylePreview variant={opt.key} />
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                          cvStyle === opt.key ? "border-brand-600" : "border-gray-300"
                        }`}
                      >
                        {cvStyle === opt.key && (
                          <span className="h-2 w-2 rounded-full bg-brand-600" />
                        )}
                      </span>
                      <span className="font-semibold text-ink-900">{opt.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${opt.tagClass}`}
                      >
                        {opt.atsTag}
                      </span>
                    </div>
                    <p className="mt-1 pl-6 text-xs text-ink-500">{opt.desc}</p>
                  </button>
                ))}
                </div>

                {cvStyle === "creative" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-800">
                      ⚠ Heads up: colourful résumés with a photo look great to people, but many ATS
                      systems parse them poorly. For online job-board applications, the standard
                      style is safer.
                    </p>
                    <div className="mt-3">
                      <span className="text-sm font-semibold text-ink-700">
                        Your photo <span className="font-normal text-ink-500">(optional)</span>
                      </span>
                      <div className="mt-2 flex items-center gap-3">
                        {photoDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoDataUrl}
                            alt="Your photo"
                            className="h-14 w-14 rounded-full object-cover"
                          />
                        ) : (
                          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-lg">
                            📷
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onPhotoChange}
                          className="text-sm text-ink-700"
                        />
                        {photoDataUrl && (
                          <button
                            type="button"
                            onClick={() => setPhotoDataUrl(null)}
                            className="text-sm font-medium text-ink-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 — ATS targeting */}
            {dialogStep === 2 && (
              <>
            <p className="mt-3 text-sm font-semibold text-ink-700">
              Optimizing for compatibility with these ATS systems
            </p>
            <p className="mt-1 text-xs text-ink-500">
              These are common applicant tracking systems employers use to screen résumés. Untick
              any you don’t care about, or add your own.
            </p>
            <div className="mt-3 space-y-2">
              {ATS_SYSTEMS.map((a) => (
                <div
                  key={a.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!atsChecked[a.key]}
                      onChange={(e) =>
                        setAtsChecked((prev) => ({ ...prev, [a.key]: e.target.checked }))
                      }
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className="text-sm font-medium text-ink-700">{a.name}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAtsInfo(a)}
                    aria-label={`About ${a.name}`}
                    title={`About ${a.name}`}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-brand-600 text-xs font-bold text-brand-600 hover:bg-brand-50"
                  >
                    i
                  </button>
                </div>
              ))}
            </div>

            {/* Custom ATS chips */}
            {customAts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {customAts.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                  >
                    {name}
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={() => setCustomAts((prev) => prev.filter((n) => n !== name))}
                      className="text-brand-700 hover:text-brand-600"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <input
                className="input flex-1"
                placeholder="Add another ATS (e.g. Jobvite)"
                value={customAtsInput}
                onChange={(e) => setCustomAtsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomAts();
                  }
                }}
              />
              <button type="button" className="btn-ghost shrink-0" onClick={addCustomAts}>
                Add
              </button>
            </div>
              </>
            )}

            {/* Step 3 — JD skills (only when the résumé is missing some) */}
            {dialogStep === 3 && offeredSkills.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-ink-700">
                  {jobDescription.trim()
                    ? "Skills the job asks for that your résumé doesn’t show"
                    : "Market-standard skills for your role that your résumé doesn’t show"}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  Tick any you genuinely have — we’ll weave them in. We won’t add skills you don’t
                  confirm.
                </p>
                <div className="mt-3 space-y-2">
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
                <input
                  className="input mt-3"
                  placeholder="Other skills you have (comma-separated)"
                  value={extraSkills}
                  onChange={(e) => setExtraSkills(e.target.value)}
                />
                <p className="mt-1 text-xs text-ink-500">
                  Only add skills you can honestly back up in an interview.
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {dialogStep === 1 && (
                <>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowSkillDialog(false)}
                  >
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" onClick={() => setDialogStep(2)}>
                    Next: ATS systems →
                  </button>
                </>
              )}
              {dialogStep === 2 && (
                <>
                  <button type="button" className="btn-ghost" onClick={() => setDialogStep(1)}>
                    ← Back
                  </button>
                  {offeredSkills.length > 0 ? (
                    <button type="button" className="btn-primary" onClick={() => setDialogStep(3)}>
                      Next: add skills →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={confirmSkillsAndOptimize}
                    >
                      Optimize my résumé →
                    </button>
                  )}
                </>
              )}
              {dialogStep === 3 && (
                <>
                  <button type="button" className="btn-ghost" onClick={() => setDialogStep(2)}>
                    ← Back
                  </button>
                  <button type="button" className="btn-primary" onClick={confirmSkillsAndOptimize}>
                    Optimize my résumé →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ATS info dialog (nested above the settings dialog) */}
      {atsInfo && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ats-info-title"
          onClick={() => setAtsInfo(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="ats-info-title" className="text-lg font-extrabold text-ink-900">
              {atsInfo.name}
            </h4>
            <p className="mt-2 text-sm text-ink-700">{atsInfo.description}</p>
            <a
              href={atsInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline"
            >
              Visit {atsInfo.name} website ↗
            </a>
            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setAtsInfo(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
