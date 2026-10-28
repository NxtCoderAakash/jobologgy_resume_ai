"use client";

/**
 * Résumé history — every past Optimizer run for the signed-in user: download the
 * optimized CV, the improvement report, or the original résumé they uploaded, and
 * re-open any of them in Résumé Studio. (Analyzer-only scans are not stored.)
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import { listJobs, getJob, type JobSummary, type JobDetail } from "@/lib/jobsApi";
import { setStudioCv } from "@/lib/handoff";
import { normalizeCv, type CvData } from "@/types/builder";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, JobDetail>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setReady(true);
    });
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          router.replace("/login");
          return;
        }
        setJobs(await listJobs(token, controller.signal));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      }
    })();
    return () => controller.abort();
  }, [ready, router]);

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (details[id]) return;
    setLoadingId(id);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace("/login");
        return;
      }
      const d = await getJob(id, token);
      setDetails((prev) => ({ ...prev, [id]: d }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  }

  function editInStudio(d: JobDetail) {
    const cv = normalizeCv(d.analysis.rewrittenCV as unknown as Partial<CvData>);
    setStudioCv({ ...cv, style: "standard" }, "Optimized résumé");
    router.push("/builder");
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
        <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">Your résumé history</h1>
        <p className="mt-1 max-w-2xl text-ink-500">
          Every résumé you optimized — download the optimized CV, the improvement report, or the
          original file you uploaded, and re-open any of them in Résumé Studio. (Analyzer-only scans
          aren&apos;t stored.)
        </p>

        {error && (
          <p className="mt-6 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {jobs === null && !error && <p className="mt-8 text-ink-500">Loading your history…</p>}

        {jobs && jobs.length === 0 && (
          <div className="mt-8 rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-ink-700">No optimized résumés yet.</p>
            <Link href="/app" className="btn-primary mt-4 inline-block px-4 py-2 text-sm">
              Optimize a résumé →
            </Link>
          </div>
        )}

        {jobs && jobs.length > 0 && (
          <ul className="mt-8 space-y-4">
            {jobs.map((j) => {
              const d = details[j.id];
              const open = openId === j.id;
              const delta = j.ats_after - j.ats_before;
              return (
                <li key={j.id} className="rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggle(j.id)}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">
                        {j.job_description && j.job_description.trim()
                          ? "JD-targeted optimization"
                          : "General optimization"}
                      </p>
                      <p className="text-sm text-ink-500">{fmtDate(j.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="whitespace-nowrap text-sm font-bold text-ink-700">
                        {j.ats_before} → <span className="text-emerald-600">{j.ats_after}</span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          delta > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-600"
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                      <span aria-hidden className="text-ink-400">
                        {open ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-slate-100 p-4">
                      {loadingId === j.id && !d && (
                        <p className="text-sm text-ink-500">Loading files…</p>
                      )}
                      {d && (
                        <div className="flex flex-wrap gap-2">
                          {d.cvPdfUrl && (
                            <a
                              href={d.cvPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary px-3 py-2 text-xs"
                            >
                              ⬇ Optimized CV (PDF)
                            </a>
                          )}
                          {d.reportPdfUrl && (
                            <a
                              href={d.reportPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost px-3 py-2 text-xs"
                            >
                              ⬇ Improvement report (PDF)
                            </a>
                          )}
                          {d.originalFileUrl && (
                            <a
                              href={d.originalFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost px-3 py-2 text-xs"
                            >
                              ⬇ Original résumé (your upload)
                            </a>
                          )}
                          {d.analysis?.rewrittenCV && (
                            <button
                              type="button"
                              onClick={() => editInStudio(d)}
                              className="btn-ghost px-3 py-2 text-xs"
                            >
                              ✎ Edit in Résumé Studio
                            </button>
                          )}
                        </div>
                      )}
                      {d && !d.cvPdfUrl && !d.originalFileUrl && (
                        <p className="text-sm text-ink-500">Files for this run aren&apos;t available.</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
