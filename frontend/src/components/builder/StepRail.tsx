"use client";

/**
 * Vertical step navigation for Résumé Studio.
 * Keyboard-accessible: it's a list of real buttons; the active step is marked
 * with aria-current. Completion checkmarks come from the parent's validation.
 */
import { STEPS, type StepId } from "@/types/builder";

export default function StepRail({
  active,
  completed,
  onGo,
}: {
  active: StepId;
  completed: Record<StepId, boolean>;
  onGo: (id: StepId) => void;
}) {
  return (
    <nav aria-label="Résumé sections" className="lg:sticky lg:top-24">
      <ol className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
        {STEPS.map((s, i) => {
          const isActive = s.id === active;
          const isDone = completed[s.id];
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onGo(s.id)}
                aria-current={isActive ? "step" : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  isActive ? "bg-brand-50" : "hover:bg-slate-100"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isActive
                        ? "bg-brand-600 text-white"
                        : "bg-slate-200 text-ink-500"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span className="hidden lg:block">
                  <span
                    className={`block text-sm font-semibold ${
                      isActive ? "text-brand-700" : "text-ink-700"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className="block text-xs text-ink-500">{s.hint}</span>
                </span>
                <span
                  className={`text-sm font-semibold lg:hidden ${
                    isActive ? "text-brand-700" : "text-ink-700"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
