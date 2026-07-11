"use client";

/**
 * "Improve with AI" — the review-before-apply suggestion panel.
 * Never overwrites silently: the AI's rephrasing and bullet ideas are shown
 * side-by-side with Accept / Keep-mine / per-idea Add actions. The request is
 * cancelable and errors are inline with a retry.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { suggestField } from "@/lib/builderApi";
import type { Suggestion, SuggestKind } from "@/types/builder";

type Phase = "idle" | "loading" | "result" | "error";

export default function AiAssist({
  kind,
  getText,
  context,
  onAccept,
  onAddBullet,
}: {
  kind: SuggestKind;
  /** Called at click time so we always improve the latest text. */
  getText: () => string;
  context?: { role?: string; company?: string };
  onAccept: (rephrased: string) => void;
  /** If provided, bullet ideas get a "+ Add" action. */
  onAddBullet?: (bullet: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    const text = getText();
    if (text.trim().length < 10) {
      setError("Write a sentence or two first, then let the AI polish it.");
      setPhase("error");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("loading");
    setError("");
    setAdded(new Set());
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired — please log in again.");
      const s = await suggestField({
        kind,
        text,
        role: context?.role,
        company: context?.company,
        token,
        signal: controller.signal,
      });
      setSuggestion(s);
      setPhase("result");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
      setPhase("error");
    }
  }

  function close() {
    abortRef.current?.abort();
    setPhase("idle");
    setSuggestion(null);
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={phase === "loading" ? close : run}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
        >
          {phase === "loading" ? (
            <>
              <Spinner /> Thinking… (click to cancel)
            </>
          ) : (
            <>✨ Improve with AI</>
          )}
        </button>
        {phase === "result" && (
          <span className="text-xs text-ink-500">Review the suggestion below — nothing is changed until you accept.</span>
        )}
      </div>

      {phase === "error" && (
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <span>{error}</span>
          <button type="button" onClick={run} className="font-semibold underline">
            Retry
          </button>
          <button type="button" onClick={close} className="text-red-500 underline">
            Dismiss
          </button>
        </div>
      )}

      {phase === "result" && suggestion && (
        <div className="mt-2 rounded-xl border border-brand-100 bg-white p-4 shadow-card">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-sm font-bold text-ink-900">AI suggestion</h4>
            <button
              type="button"
              onClick={close}
              aria-label="Close suggestion"
              className="text-ink-500 hover:text-ink-900"
            >
              ✕
            </button>
          </div>
          <p className="whitespace-pre-wrap rounded-lg bg-brand-50/60 p-3 text-sm text-ink-700">
            {suggestion.rephrased}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onAccept(suggestion.rephrased);
                close();
              }}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Use this version
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
            >
              Keep mine
            </button>
          </div>

          {suggestion.bulletIdeas.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">
                Ideas to add
              </h5>
              <ul className="space-y-1.5">
                {suggestion.bulletIdeas.map((idea, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                    <span className="mt-0.5 text-brand-500">•</span>
                    <span className="flex-1">{idea}</span>
                    {onAddBullet && (
                      <button
                        type="button"
                        disabled={added.has(i)}
                        onClick={() => {
                          onAddBullet(idea);
                          setAdded((prev) => new Set(prev).add(i));
                        }}
                        className="shrink-0 rounded-md border border-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40"
                      >
                        {added.has(i) ? "Added ✓" : "+ Add"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700"
    />
  );
}
