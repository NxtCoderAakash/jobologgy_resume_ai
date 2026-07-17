"use client";

/**
 * Live "scanning" visual shown while the AI call runs: the user's OWN résumé
 * (real PDF page render / image / pasted text) with an animated scan beam
 * sweeping over it, so it feels like the document is genuinely being read.
 *
 * Rendering strategy by input:
 *  - pasted text            -> styled mini document with the actual text
 *  - image upload           -> the image itself (object URL)
 *  - .txt file              -> its text, like pasted text
 *  - PDF                    -> page 1 rendered to a canvas via lazy pdfjs-dist
 *  - DOCX / render failure  -> stylized document skeleton + real filename
 */
import { useEffect, useRef, useState } from "react";

type Mode = "loading" | "text" | "image" | "pdf" | "skeleton";

export default function ScanningPreview({
  file,
  resumeText,
}: {
  file: File | null;
  resumeText?: string;
}) {
  const [mode, setMode] = useState<Mode>("loading");
  const [text, setText] = useState("");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function prepare() {
      // Pasted text wins — it's always the exact content being scanned.
      if (resumeText && resumeText.trim()) {
        setText(resumeText);
        setMode("text");
        return;
      }
      if (!file) {
        setMode("skeleton");
        return;
      }
      const name = file.name.toLowerCase();

      if (file.type.startsWith("image/")) {
        objectUrl = URL.createObjectURL(file);
        setImgUrl(objectUrl);
        setMode("image");
        return;
      }
      if (file.type === "text/plain" || name.endsWith(".txt")) {
        try {
          const t = await file.text();
          if (cancelled) return;
          setText(t);
          setMode("text");
        } catch {
          setMode("skeleton");
        }
        return;
      }
      if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        try {
          // Lazy-load pdf.js only when a PDF is actually being previewed.
          // Legacy build: transpiled so Next's bundler can parse it. The worker
          // is served statically from /public (see scripts/copy-pdf-worker.js)
          // so webpack never parses that file either.
          // @ts-ignore — the legacy entry ships no types; same API as the main build.
          const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as typeof import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          const data = await file.arrayBuffer();
          const doc = await pdfjs.getDocument({ data }).promise;
          const page = await doc.getPage(1);
          if (cancelled) return;

          const canvas = canvasRef.current;
          if (!canvas) return;
          // Fit the page to the preview width, render at 2x for crispness.
          const base = page.getViewport({ scale: 1 });
          const scale = (canvas.parentElement?.clientWidth || 360) / base.width;
          const viewport = page.getViewport({ scale: scale * 2 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          if (cancelled) return;
          setMode("pdf");
        } catch {
          if (!cancelled) setMode("skeleton");
        }
        return;
      }
      // DOCX and anything else we can't draw in the browser.
      setMode("skeleton");
    }

    // The canvas must exist before pdf.js renders into it, so flip to a
    // neutral state first, then prepare.
    setMode(file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) ? "pdf" : "loading");
    prepare();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, resumeText]);

  return (
    <div>
      <div className="relative h-[320px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        {/* ---- the document being scanned ---- */}
        {mode === "text" && (
          <pre className="h-full w-full overflow-hidden whitespace-pre-wrap break-words p-4 font-sans text-[7.5px] leading-[11px] text-slate-700">
            {text.slice(0, 4000)}
          </pre>
        )}
        {mode === "image" && imgUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt="Your résumé" className="h-full w-full object-contain object-top" />
        )}
        <canvas
          ref={canvasRef}
          className={`w-full ${mode === "pdf" ? "" : "hidden"}`}
          aria-label="Your résumé"
        />
        {(mode === "skeleton" || mode === "loading") && (
          <div className="h-full w-full p-5">
            {file && (
              <p className="mb-3 truncate text-xs font-semibold text-ink-700">📄 {file.name}</p>
            )}
            <div className="space-y-2.5">
              {[92, 60, 0, 78, 95, 88, 40, 0, 70, 90, 85, 55, 0, 82, 66, 91, 74].map((w, i) =>
                w === 0 ? (
                  <div key={i} className="h-2" />
                ) : (
                  <div
                    key={i}
                    className="scan-shimmer h-2 rounded bg-slate-200"
                    style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }}
                  />
                ),
              )}
            </div>
          </div>
        )}

        {/* ---- scanner overlay ---- */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* sweeping beam + trailing tint */}
          <div className="scan-beam absolute left-0 right-0">
            <div className="h-10 w-full bg-gradient-to-b from-transparent to-brand-500/20" />
            <div className="h-[3px] w-full bg-brand-500 shadow-[0_0_12px_2px_rgba(59,130,246,.75)]" />
          </div>
          {/* corner brackets, like a scanner viewfinder */}
          {[
            "left-2 top-2 border-l-2 border-t-2",
            "right-2 top-2 border-r-2 border-t-2",
            "bottom-2 left-2 border-b-2 border-l-2",
            "bottom-2 right-2 border-b-2 border-r-2",
          ].map((pos) => (
            <span key={pos} className={`absolute h-5 w-5 rounded-sm border-brand-500/80 ${pos}`} />
          ))}
        </div>
      </div>

      <p className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-brand-700">
        <span className="inline-block h-2 w-2 animate-ping rounded-full bg-brand-500" />
        Scanning your résumé…
      </p>
    </div>
  );
}
