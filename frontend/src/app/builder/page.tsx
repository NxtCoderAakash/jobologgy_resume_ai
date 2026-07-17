"use client";

/**
 * Résumé Studio — guided, section-by-section résumé builder with inline AI.
 * Additive feature: lives entirely on /builder; the /app optimizer is untouched.
 *
 * Flow: start (import / blank / saved draft) -> editing (step rail + form +
 * live preview) -> finish (validate + download PDF). Drafts autosave and the
 * URL carries ?draft=<id> so refresh/deep-links restore progress.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import FileDropzone from "@/components/FileDropzone";
import LoadingProgress from "@/components/LoadingProgress";
import StepRail from "@/components/builder/StepRail";
import CvPreview from "@/components/builder/CvPreview";
import {
  ContactForm,
  SummaryForm,
  SkillsForm,
  ExperienceForm,
  EducationForm,
  ExtrasForm,
} from "@/components/builder/SectionForms";
import {
  importResume,
  saveDraft,
  getDraft,
  listDrafts,
  deleteDraft,
  renderCvPdf,
} from "@/lib/builderApi";
import { validateCv } from "@/lib/builderValidation";
import { takeStudioCv } from "@/lib/handoff";
import { emptyCv, normalizeCv, STEPS, type CvData, type DraftMeta, type StepId } from "@/types/builder";

const IMPORT_MESSAGES = [
  "Reading your file…",
  "Extracting the text…",
  "Detecting your sections…",
  "Structuring your experience and skills…",
  "Filling in the editor…",
];

const PDF_MESSAGES = [
  "Laying out your résumé…",
  "Applying the ATS-safe template…",
  "Rendering your PDF…",
  "Almost there…",
];

type SaveState = "clean" | "dirty" | "saving" | "saved" | "error";

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <NavBar />
          <p className="mt-20 text-center text-ink-500">Loading…</p>
        </main>
      }
    >
      <Builder />
    </Suspense>
  );
}

function Builder() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"start" | "editing">("start");

  // ---- start screen state ----
  const [file, setFile] = useState<File | null>(null);
  const [usePaste, setUsePaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  // Holds the imported CV during the loader's completion animation.
  const [pendingImport, setPendingImport] = useState<CvData | null>(null);
  const [startError, setStartError] = useState("");
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);

  // ---- editor state ----
  const [cv, setCv] = useState<CvData>(emptyCv);
  const [title, setTitle] = useState("Untitled résumé");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>("contact");
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [showPreview, setShowPreview] = useState(false); // mobile toggle
  const [downloading, setDownloading] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const validation = validateCv(cv);

  async function getToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace("/login");
      throw new Error("Not logged in");
    }
    return token;
  }

  // Auth guard + restore a deep-linked draft + load the drafts list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      if (cancelled) return;
      setReady(true);

      const token = data.session.access_token;
      const wanted = searchParams.get("draft");
      // Optimizer → Studio hand-off: open pre-filled with the optimized résumé.
      const studio = wanted ? null : takeStudioCv();
      if (studio) {
        setCv(normalizeCv(studio.cv));
        setTitle(studio.title || "Optimized résumé");
        setPhase("editing");
        // Mark dirty so autosave persists it as a new draft.
        scheduleSave(normalizeCv(studio.cv), studio.title || "Optimized résumé");
      } else if (wanted) {
        try {
          const d = await getDraft({ id: wanted, token });
          if (cancelled) return;
          setCv(d.cv);
          setTitle(d.title);
          setDraftId(d.id);
          setPhase("editing");
        } catch {
          // Bad/foreign draft id — fall back to the start screen.
          router.replace("/builder");
        }
      }
      try {
        const list = await listDrafts(token);
        if (!cancelled) setDrafts(list);
      } catch {
        /* drafts list is non-critical */
      } finally {
        if (!cancelled) setDraftsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (saveState === "dirty" || saveState === "saving" || saveState === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  // Debounced autosave whenever the CV or title changes while editing.
  const scheduleSave = useCallback(
    (nextCv: CvData, nextTitle: string) => {
      setSaveState("dirty");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (savingRef.current) return; // a save is in flight; the next edit reschedules
        savingRef.current = true;
        setSaveState("saving");
        try {
          const token = await getToken();
          const res = await saveDraft({ id: draftId ?? undefined, title: nextTitle, cv: nextCv, token });
          setDraftId(res.id);
          setSaveState("saved");
          // Put the draft id in the URL so refresh restores this session.
          router.replace(`/builder?draft=${res.id}`, { scroll: false });
        } catch {
          setSaveState("error");
        } finally {
          savingRef.current = false;
        }
      }, 1500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftId],
  );

  const patch = useCallback(
    (updater: (prev: CvData) => CvData) => {
      setCv((prev) => {
        const next = updater(prev);
        scheduleSave(next, title);
        return next;
      });
    },
    [scheduleSave, title],
  );

  function changeTitle(next: string) {
    setTitle(next);
    scheduleSave(cv, next);
  }

  // ---- start screen actions ----

  async function startFromImport() {
    setStartError("");
    if (!usePaste && !file) {
      setStartError("Upload a résumé file, or switch to pasting text.");
      return;
    }
    if (usePaste && pasteText.trim().length < 30) {
      setStartError("Paste your résumé text first (a few lines at least).");
      return;
    }
    setImporting(true);
    try {
      const token = await getToken();
      const imported = await importResume({
        file: usePaste ? null : file,
        resumeText: usePaste ? pasteText : undefined,
        token,
      });
      // Don't switch to the editor yet — let the loader complete to 100% first.
      setPendingImport(imported);
    } catch (err) {
      setStartError((err as Error).message);
      setImporting(false);
    }
  }

  function finishImport() {
    if (!pendingImport) return;
    const imported = pendingImport;
    const newTitle = imported.fullName ? `${imported.fullName} — résumé` : "Imported résumé";
    setCv(imported);
    setTitle(newTitle);
    setPhase("editing");
    setStep("contact");
    scheduleSave(imported, newTitle);
    setPendingImport(null);
    setImporting(false);
  }

  function startBlank() {
    setCv(emptyCv());
    setTitle("Untitled résumé");
    setDraftId(null);
    setPhase("editing");
    setStep("contact");
    setSaveState("clean");
  }

  async function openDraft(id: string) {
    try {
      const token = await getToken();
      const d = await getDraft({ id, token });
      setCv(d.cv);
      setTitle(d.title);
      setDraftId(d.id);
      setPhase("editing");
      setStep("contact");
      setSaveState("clean");
      router.replace(`/builder?draft=${d.id}`, { scroll: false });
    } catch (err) {
      setStartError((err as Error).message);
    }
  }

  async function removeDraft(id: string) {
    if (!window.confirm("Delete this draft? This can't be undone.")) return;
    try {
      const token = await getToken();
      await deleteDraft({ id, token });
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch {
      /* leave the row; user can retry */
    }
  }

  // ---- finish/download ----

  async function download() {
    setDownloadError("");
    if (validation.errors.length > 0) {
      setDownloadError("Fix the items marked in red before downloading.");
      return;
    }
    setDownloading(true);
    try {
      const token = await getToken();
      const blob = await renderCvPdf({ cv, token });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(cv.fullName || "resume").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "resume"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // Let the loader complete to 100% before returning to idle.
      setPdfDone(true);
    } catch (err) {
      setDownloadError(
        `${(err as Error).message} — if the server was idle, the first try can take up to a minute; try again.`,
      );
      setDownloading(false);
    }
  }

  // ---- render ----

  if (!ready) {
    return (
      <main className="min-h-screen">
        <NavBar />
        <p className="mt-20 text-center text-ink-500">Loading…</p>
      </main>
    );
  }

  if (phase === "start") {
    return (
      <main className="min-h-screen">
        <NavBar />
        <div className="mx-auto max-w-4xl px-6 py-10">
          <h1 className="text-3xl font-extrabold text-ink-900">Résumé Studio</h1>
          <p className="mt-1 text-ink-500">
            Build a polished, ATS-safe résumé section by section — with AI suggestions you
            review before applying.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink-900">Import your résumé</h2>
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
                  className="input min-h-[180px] resize-y"
                  placeholder="Paste your current résumé text here…"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
              ) : (
                <FileDropzone file={file} onFile={setFile} />
              )}
              <button
                type="button"
                onClick={startFromImport}
                disabled={importing}
                className="btn-primary mt-4 w-full"
              >
                {importing ? (
                  <>
                    <span
                      aria-hidden
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />
                    Importing…
                  </>
                ) : (
                  "Import & edit →"
                )}
              </button>

              {importing && (
                <div className="mt-4">
                  <LoadingProgress
                    title="Importing your résumé…"
                    expectedSeconds={15}
                    messages={IMPORT_MESSAGES}
                    done={!!pendingImport}
                    doneMessage="Imported — opening the editor…"
                    onDone={finishImport}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <div className="card">
                <h2 className="text-lg font-bold text-ink-900">Start from scratch</h2>
                <p className="mt-1 text-sm text-ink-500">
                  A guided, empty résumé — fill in each section at your pace.
                </p>
                <button type="button" onClick={startBlank} className="btn-ghost mt-4 w-full">
                  Start blank →
                </button>
              </div>

              <div className="card flex-1">
                <h2 className="text-lg font-bold text-ink-900">Your drafts</h2>
                {draftsLoading ? (
                  <p className="mt-3 text-sm text-ink-500">Loading drafts…</p>
                ) : drafts.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-500">
                    Nothing saved yet — drafts autosave while you edit.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {drafts.map((d) => (
                      <li key={d.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openDraft(d.id)}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-ink-700 transition hover:border-brand-400 hover:bg-brand-50"
                        >
                          {d.title}
                          <span className="block text-xs font-normal text-ink-500">
                            Updated {new Date(d.updated_at).toLocaleString()}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${d.title}`}
                          onClick={() => removeDraft(d.id)}
                          className="rounded-md px-2 py-2 text-ink-500 hover:bg-red-50 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {startError && (
            <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{startError}</p>
          )}
        </div>
      </main>
    );
  }

  // ---- editing ----
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const stepMeta = STEPS[stepIndex];

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Header row: title + save state + mobile preview toggle */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            aria-label="Draft title"
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-extrabold text-ink-900 outline-none transition hover:border-slate-200 focus:border-brand-500"
            value={title}
            onChange={(e) => changeTitle(e.target.value)}
          />
          <SaveBadge state={saveState} />
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="btn-ghost px-4 py-2 text-sm lg:hidden"
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,420px)]">
          <StepRail active={step} completed={validation.completed} onGo={setStep} />

          {/* Form column (hidden on mobile when previewing) */}
          <div className={showPreview ? "hidden lg:block" : ""}>
            <div className="card">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-ink-900">{stepMeta.label}</h2>
                <p className="text-sm text-ink-500">{stepMeta.hint}</p>
              </div>

              {step === "contact" && <ContactForm cv={cv} patch={patch} />}
              {step === "summary" && <SummaryForm cv={cv} patch={patch} />}
              {step === "skills" && <SkillsForm cv={cv} patch={patch} />}
              {step === "experience" && <ExperienceForm cv={cv} patch={patch} />}
              {step === "education" && <EducationForm cv={cv} patch={patch} />}
              {step === "extras" && <ExtrasForm cv={cv} patch={patch} />}
              {step === "finish" && (
                <FinishStep
                  validation={validation}
                  downloading={downloading}
                  pdfDone={pdfDone}
                  onPdfDone={() => {
                    setPdfDone(false);
                    setDownloading(false);
                  }}
                  downloadError={downloadError}
                  onDownload={download}
                />
              )}

              {/* Back / Next */}
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={stepIndex === 0}
                  onClick={() => setStep(STEPS[stepIndex - 1].id)}
                  className="btn-ghost px-4 py-2 text-sm disabled:invisible"
                >
                  ← {stepIndex > 0 ? STEPS[stepIndex - 1].label : ""}
                </button>
                {stepIndex < STEPS.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(STEPS[stepIndex + 1].id)}
                    className="btn-primary px-4 py-2 text-sm"
                  >
                    {STEPS[stepIndex + 1].label} →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Preview column */}
          <div className={`${showPreview ? "" : "hidden"} lg:block`}>
            <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              <CvPreview cv={cv} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; cls: string }> = {
    clean: { text: "", cls: "" },
    dirty: { text: "Unsaved changes", cls: "text-ink-500" },
    saving: { text: "Saving…", cls: "text-ink-500" },
    saved: { text: "Saved ✓", cls: "text-emerald-600" },
    error: { text: "Save failed — will retry on next edit", cls: "text-red-600" },
  };
  const { text, cls } = map[state];
  if (!text) return null;
  return <span className={`shrink-0 text-xs font-semibold ${cls}`}>{text}</span>;
}

function FinishStep({
  validation,
  downloading,
  pdfDone,
  onPdfDone,
  downloadError,
  onDownload,
}: {
  validation: ReturnType<typeof validateCv>;
  downloading: boolean;
  pdfDone: boolean;
  onPdfDone: () => void;
  downloadError: string;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-5">
      {validation.errors.length > 0 && (
        <div className="rounded-xl bg-red-50 p-4">
          <h3 className="mb-2 text-sm font-bold text-red-700">Fix before downloading</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {validation.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-4">
          <h3 className="mb-2 text-sm font-bold text-amber-700">Suggestions (optional)</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
            {validation.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.errors.length === 0 && validation.warnings.length === 0 && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Looking great — your résumé passes every check. ✓
        </p>
      )}

      {downloadError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{downloadError}</p>
      )}

      <button
        type="button"
        onClick={onDownload}
        disabled={downloading || validation.errors.length > 0}
        className="btn-primary w-full"
      >
        {downloading ? (
          <>
            <span
              aria-hidden
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
            Generating your PDF…
          </>
        ) : (
          "Download PDF ↓"
        )}
      </button>

      {downloading && (
        <LoadingProgress
          title="Generating your PDF…"
          expectedSeconds={12}
          messages={PDF_MESSAGES}
          done={pdfDone}
          doneMessage="PDF downloaded — check your downloads folder."
          onDone={onPdfDone}
        />
      )}
      <p className="text-center text-xs text-ink-500">
        Single-column, real-text PDF — safe for every ATS. Your draft stays saved for later edits.
      </p>
    </div>
  );
}
