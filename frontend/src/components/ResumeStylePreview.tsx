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
          {/* photo placeholder — signals "your photo goes here" */}
          <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-white/80 bg-white/25 text-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6Z" />
            </svg>
            <span className="absolute -bottom-[1px] rounded-sm bg-black/35 px-[2px] text-[4px] font-semibold leading-[6px] text-white">
              PHOTO
            </span>
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
