"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { analyzeResume } from "@/lib/api";
import type { AnalyzeResult } from "@/types/analysis";
import NavBar from "@/components/NavBar";
import FileDropzone from "@/components/FileDropzone";
import AnalysisReport from "@/components/AnalysisReport";

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

  // Route guard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setReady(true);
    });
  }, [router]);

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
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
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
        <h1 className="text-3xl font-extrabold text-ink-900">Résumé Optimizer</h1>
        <p className="mt-1 text-ink-500">
          Upload your CV and a job description — get an ATS-optimized résumé, a before/after
          score, and a report of every improvement.
        </p>

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
              {busy ? "Optimizing… this can take ~20s" : "Optimize my résumé →"}
            </button>
          </div>
        </form>

        {result && (
          <div className="mt-12">
            <h2 className="mb-4 text-2xl font-extrabold text-ink-900">Your results</h2>
            <AnalysisReport result={result} />
          </div>
        )}
      </div>
    </main>
  );
}
