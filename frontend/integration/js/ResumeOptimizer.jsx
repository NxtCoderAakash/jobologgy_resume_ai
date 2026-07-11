"use client";

import React, { useState } from "react";
import { analyzeResume } from "./api";

/**
 * Self-contained AI Resume Optimizer feature (JavaScript).
 * Inline styles only — no Tailwind / global CSS required.
 *
 * Props:
 *   backendUrl: string
 *   getToken:  () => Promise<string>   // returns the user's Supabase JWT
 */

const C = {
  brand: "#2563eb",
  brandBg: "#eff6ff",
  ink: "#0f172a",
  sub: "#64748b",
  green: "#16a34a",
  greenBg: "#ecfdf5",
  red: "#dc2626",
  redBg: "#fef2f2",
  border: "#e2e8f0",
};

const S = {
  wrap: { fontFamily: "Inter, system-ui, sans-serif", color: C.ink, maxWidth: 980, margin: "0 auto" },
  card: {
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    background: "#fff",
    padding: 24,
    boxShadow: "0 8px 24px rgba(15,23,42,.06)",
  },
  h2: { fontSize: 18, fontWeight: 700, margin: 0 },
  textarea: {
    width: "100%",
    minHeight: 200,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: 12,
    fontFamily: "inherit",
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
  },
  btn: {
    background: C.brand,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "12px 20px",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: C.brand,
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  grid2: { display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" },
  chip: (bg, color, bd) => ({
    display: "inline-block",
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: 13,
    margin: "0 6px 6px 0",
    background: bg,
    color,
    border: `1px solid ${bd}`,
  }),
};

export function ResumeOptimizer({ backendUrl, getToken }) {
  const [file, setFile] = useState(null);
  const [usePaste, setUsePaste] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (jobDescription.trim().length < 20)
      return setError("Please paste a job description (a few sentences).");
    if (!usePaste && !file) return setError("Upload a résumé file, or paste text.");
    if (usePaste && resumeText.trim().length < 30)
      return setError("Please paste your résumé text.");

    setBusy(true);
    try {
      const token = await getToken();
      if (!token) return setError("You must be signed in.");
      const res = await analyzeResume({
        backendUrl,
        token,
        jobDescription,
        file: usePaste ? null : file,
        resumeText: usePaste ? resumeText : undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={S.wrap}>
      <form onSubmit={onSubmit} style={S.grid2}>
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={S.h2}>Your résumé</h2>
            <button type="button" style={S.linkBtn} onClick={() => setUsePaste((v) => !v)}>
              {usePaste ? "Upload a file instead" : "Paste text instead"}
            </button>
          </div>
          {usePaste ? (
            <textarea
              style={S.textarea}
              placeholder="Paste your current résumé text…"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
          ) : (
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: `2px dashed ${C.border}`,
                borderRadius: 16,
                padding: "36px 16px",
                cursor: "pointer",
                background: "#f8fafc",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: 28 }}>📎</span>
              <span style={{ marginTop: 8, fontWeight: 600 }}>
                {file ? file.name : "Click to upload your résumé"}
              </span>
              <span style={{ marginTop: 4, fontSize: 13, color: C.sub }}>
                PDF, DOCX, PNG/JPG, or TXT
              </span>
              <input
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/*"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>Job description</h2>
          <textarea
            style={{ ...S.textarea, marginTop: 12 }}
            placeholder="Paste the full job description…"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          {error && (
            <p style={{ background: C.redBg, color: C.red, padding: "10px 14px", borderRadius: 10 }}>
              {error}
            </p>
          )}
          <button type="submit" style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} disabled={busy}>
            {busy ? "Optimizing… ~20s" : "Optimize my résumé →"}
          </button>
        </div>
      </form>

      {result && <Results result={result} />}
    </div>
  );
}

function Gauge({ value, label }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const color = v >= 75 ? C.green : v >= 50 ? "#d97706" : C.red;
  const r = 46;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <svg viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r={r} fill="none" stroke={C.border} strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ - (v / 100) * circ}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 800,
            color,
          }}
        >
          {v}
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>{label}</div>
    </div>
  );
}

function Chips({ items, kind }) {
  const map = {
    missing: [C.redBg, C.red, "#fecaca"],
    added: [C.greenBg, "#047857", "#a7f3d0"],
    matched: [C.brandBg, C.brand, "#bfdbfe"],
  };
  const [bg, color, bd] = map[kind];
  if (!items.length) return <span style={{ color: C.sub, fontStyle: "italic" }}>None</span>;
  return (
    <div>
      {items.map((i) => (
        <span key={i} style={S.chip(bg, color, bd)}>
          {i}
        </span>
      ))}
    </div>
  );
}

function Results({ result }) {
  const a = result.analysis;
  const delta = Math.round(a.atsScoreAfter - a.atsScoreBefore);

  return (
    <div style={{ marginTop: 32, display: "grid", gap: 24 }}>
      <div style={S.card}>
        <h2 style={S.h2}>Download your PDFs</h2>
        <div style={{ ...S.grid2, marginTop: 16 }}>
          {[
            ["Optimized CV", result.cvPdfUrl],
            ["Improvement report", result.reportPdfUrl],
          ].map(([title, url]) => (
            <div key={title} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700 }}>{title}</div>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <button style={{ ...S.btn, marginTop: 12, width: "100%" }}>Download PDF</button>
                </a>
              ) : (
                <p style={{ color: C.sub, fontSize: 13, marginTop: 12 }}>
                  PDF not stored (configure Supabase storage).
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <h2 style={S.h2}>ATS score</h2>
        <div style={{ display: "flex", gap: 24, alignItems: "center", justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
          <Gauge value={a.atsScoreBefore} label="Before" />
          <div style={{ textAlign: "center", color: C.sub }}>
            <div style={{ fontSize: 26 }}>→</div>
            <div style={{ ...S.chip(C.greenBg, "#15803d", "#a7f3d0"), fontWeight: 700 }}>+{delta} pts</div>
          </div>
          <Gauge value={a.atsScoreAfter} label="After" />
        </div>
      </div>

      <div style={S.card}>
        <h2 style={S.h2}>Keyword matching</h2>
        <div style={{ marginTop: 12 }}>
          <p style={{ fontWeight: 600, color: C.red }}>⚠ What was lacking</p>
          <Chips items={a.keywordAnalysis.missingBefore} kind="missing" />
          <p style={{ fontWeight: 600, color: "#047857", marginTop: 12 }}>✓ What it now has</p>
          <Chips items={a.keywordAnalysis.addedInNew} kind="added" />
          <p style={{ fontWeight: 600, color: C.brand, marginTop: 12 }}>Already matched</p>
          <Chips items={a.keywordAnalysis.matchedBefore} kind="matched" />
        </div>
      </div>

      <div style={S.card}>
        <h2 style={S.h2}>What caused the improvement</h2>
        <p style={{ color: C.sub, fontSize: 14 }}>{a.summaryOfChanges}</p>
        {a.improvements.map((imp, i) => (
          <div key={i} style={{ borderLeft: `3px solid ${C.brand}`, paddingLeft: 12, marginTop: 14 }}>
            <div style={{ fontWeight: 700 }}>{imp.area}</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              <b style={{ color: C.red }}>Before:</b> {imp.before}
            </div>
            <div style={{ fontSize: 14, marginTop: 2 }}>
              <b style={{ color: "#15803d" }}>After:</b> {imp.after}
            </div>
            <div style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>
              <b>Why it improved:</b> {imp.reason}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
