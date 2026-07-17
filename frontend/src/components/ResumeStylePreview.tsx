"use client";

/**
 * Miniature visual mock of each CV template, shown in the style picker so the
 * user sees the predicted layout (not just a text description). These mirror the
 * backend templates: cvTemplate.ts (standard) and creativeCvTemplate.ts (creative).
 * Sample content only — the user's real content fills the actual PDF.
 */

function Lines({ n, accent }: { n: number; accent?: boolean }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] rounded ${accent ? "bg-fuchsia-100" : "bg-slate-200"}`}
          style={{ width: `${92 - i * 14}%` }}
        />
      ))}
    </div>
  );
}

export default function ResumeStylePreview({
  variant,
}: {
  variant: "standard" | "creative";
}) {
  if (variant === "creative") {
    return (
      <div className="h-[188px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div
          className="flex items-center gap-2 px-3 py-2.5"
          style={{ background: "linear-gradient(135deg,#7c3aed,#d946ef,#f472b6)" }}
        >
          <div className="grid h-9 w-9 place-items-center rounded-full border border-white/80 bg-white/25 text-[8px] font-extrabold text-white">
            JB
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold leading-tight text-white">Jordan Blake</div>
            <div className="text-[7px] font-semibold text-pink-100">Senior Product Designer</div>
            <div className="text-[5px] text-pink-100">jordan@email.com • San Francisco</div>
          </div>
        </div>
        <div className="space-y-2 p-3">
          {["Profile", "Skills", "Experience"].map((h) => (
            <div key={h}>
              <div className="mb-1 border-l-2 border-[#d946ef] pl-1.5 text-[7px] font-bold uppercase tracking-wide text-[#7c3aed]">
                {h}
              </div>
              {h === "Skills" ? (
                <div className="flex flex-wrap gap-1">
                  {["Figma", "Design Systems", "Prototyping", "UX"].map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-[#e6d5ff] bg-[#f5edff] px-1.5 py-[1px] text-[5.5px] font-semibold text-[#7c3aed]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <Lines n={2} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // standard
  return (
    <div className="h-[188px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[12px] font-extrabold leading-tight text-[#0f172a]">Jordan Blake</div>
      <div className="text-[7px] font-semibold text-[#2563eb]">Senior Product Designer</div>
      <div className="text-[5px] text-slate-400">jordan@email.com • +1 555 0100 • San Francisco</div>
      {["Experience", "Skills", "Education"].map((h) => (
        <div key={h}>
          <div className="mb-1 mt-2 border-b border-[#2563eb] pb-[2px] text-[6.5px] font-bold uppercase tracking-wide text-[#0f172a]">
            {h}
          </div>
          {h === "Skills" ? (
            <div className="flex flex-wrap gap-1">
              {["Figma", "Design Systems", "Prototyping", "UX"].map((s) => (
                <span
                  key={s}
                  className="rounded bg-[#eff6ff] px-1.5 py-[1px] text-[5.5px] font-medium text-[#1d4ed8]"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <Lines n={h === "Education" ? 1 : 2} />
          )}
        </div>
      ))}
    </div>
  );
}
