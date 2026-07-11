"use client";

/**
 * Rich loading feedback for long AI calls.
 *  - Animated progress bar that eases toward (but never reaches) 100%
 *  - Rotating status messages so the user has something to read
 *  - Visible countdown ("~Ns left"); when it runs out, flips to a reassuring
 *    "taking a little longer" mode with an elapsed count-up
 *  - Stays mounted until the caller unmounts it (API success or failure)
 */
import { useEffect, useState } from "react";

export default function LoadingProgress({
  expectedSeconds = 15,
  messages,
  title = "Working on it…",
}: {
  /** Typical duration; the countdown runs from this. */
  expectedSeconds?: number;
  /** Rotating status lines (one shown at a time). */
  messages: string[];
  title?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(t);
  }, []);

  const overdue = elapsed >= expectedSeconds;
  const remaining = Math.max(0, expectedSeconds - elapsed);
  const msgIndex = Math.floor(elapsed / 3) % messages.length;

  // Progress eases toward 90% across expectedSeconds, then crawls — honest
  // "still working" without pretending to know the exact finish time.
  const pct = overdue
    ? Math.min(97, 90 + (elapsed - expectedSeconds) * 0.3)
    : Math.min(90, (elapsed / expectedSeconds) * 90);

  return (
    <div
      role="status"
      aria-live="polite"
      className="card border-brand-100 bg-gradient-to-br from-white to-brand-50/40"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600"
        />
        <h3 className="text-base font-bold text-ink-900">{title}</h3>
        <span className="ml-auto shrink-0 font-mono text-sm font-semibold tabular-nums text-ink-700">
          {overdue ? `${elapsed}s` : `~${remaining}s left`}
        </span>
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-brand-600 ${overdue ? "animate-pulse" : ""}`}
          style={{ width: `${pct}%`, transition: "width .5s ease" }}
        />
      </div>

      <p className="mt-3 min-h-[1.5rem] text-sm text-ink-700" key={msgIndex}>
        {messages[msgIndex]}
      </p>

      {overdue && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          ⏳ This is taking a little longer than usual — kindly wait. If the server was idle it
          needs a moment to wake up; we&apos;ll show your result the second it&apos;s ready.
        </p>
      )}
    </div>
  );
}
