"use client";

/**
 * Consent dialog shown when the user submits without a job description.
 * Explains the fallback — a general scan against the market-standard job
 * profile for their current role — and lets them proceed or go add a JD.
 */
export default function NoJdDialog({
  open,
  onProceed,
  onAddJd,
}: {
  open: boolean;
  /** User approved scanning without a JD. */
  onProceed: () => void;
  /** User wants to go back and paste a JD (caller should focus the textarea). */
  onAddJd: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nojd-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
        <h3 id="nojd-title" className="text-xl font-extrabold text-ink-900">
          No job description?
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-700">
          That&apos;s okay — without one, we&apos;ll compare your résumé against{" "}
          <strong>market-standard job profiles for your current position</strong> and run a
          general ATS keyword scan, so you still get a meaningful score and feedback.
        </p>
        <p className="mt-2 text-xs text-ink-500">
          Tip: pasting the actual job description you&apos;re applying to gives the most
          accurate, tailored results.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" onClick={onAddJd}>
            Add a job description
          </button>
          <button type="button" className="btn-primary" onClick={onProceed}>
            Proceed with general scan →
          </button>
        </div>
      </div>
    </div>
  );
}
