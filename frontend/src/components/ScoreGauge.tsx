"use client";

export default function ScoreGauge({
  value,
  label,
  emphasize = false,
}: {
  value: number;
  label: string;
  emphasize?: boolean;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const color = v >= 75 ? "#16a34a" : v >= 50 ? "#d97706" : "#dc2626";
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (v / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset .8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={emphasize ? "text-4xl font-extrabold" : "text-3xl font-bold"}
            style={{ color }}
          >
            {v}
          </span>
          <span className="text-xs text-ink-500">/ 100</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-semibold text-ink-700">{label}</span>
    </div>
  );
}
