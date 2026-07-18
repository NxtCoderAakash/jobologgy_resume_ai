"use client";

/**
 * Floating résumé/career coach — a chat bubble (the Yeti mascot) available on
 * every page once logged in. Streams replies from POST /api/chat. Mobile-first
 * and overflow-safe per FRONTEND_GUIDELINES (R2/R5/R7).
 *
 * - History persists per user in localStorage (survives reload).
 * - Context-aware: pages publish the résumé the user is working on.
 * - Attachments: a file can be uploaded; POST /api/extract turns it into text
 *   the coach reads.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { streamChat, extractFile, type ChatMessage } from "@/lib/chatApi";
import { analyzeResume } from "@/lib/api";
import { getChatContext, subscribeChatContext, type ChatContext } from "@/lib/chatContext";
import BotMascot from "@/components/BotMascot";

const GREETING =
  "Hi! I'm your résumé coach. Paste a résumé, attach a file, or drop a bullet point and I'll sharpen it, compare it to a job description, or prep you for interviews. I can even run a full ATS optimization and hand you the PDF right here. What are you working on?";

const SUGGESTIONS = [
  "Review my résumé",
  "Rewrite a bullet point with impact",
  "Write a professional summary",
  "Interview prep tips",
];

const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/*";
const MAX_FILE_BYTES = 12 * 1024 * 1024;

/** An optimize result rendered as a score + download card in the bubble. */
interface OptimizeResult {
  before: number;
  after: number;
  cvUrl: string | null;
  reportUrl: string | null;
}

/** A turn. `apiContent` (when set) is sent to the model instead of `content`,
 *  letting us attach the résumé/file without showing the dump in the bubble.
 *  `file` is a display-only attachment label; `working` shows a labelled
 *  spinner during a long action; `optimize` renders a result card. */
interface Msg extends ChatMessage {
  apiContent?: string;
  file?: string;
  working?: string;
  optimize?: OptimizeResult;
}

const storageKey = (email: string) => `jobologgy.chat.${email}`;

/** Bold **text** and keep line breaks (whitespace-pre-wrap on the container). */
function renderRich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**") ? (
      <strong key={i}>{seg.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
}

/** Vibrant three-dot typing/working indicator (reduced-motion friendly). */
function Dots() {
  return (
    <span className="inline-flex gap-1">
      <span className="h-2 w-2 rounded-full bg-brand-500 motion-safe:animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-brand-500 motion-safe:animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-brand-500 motion-safe:animate-bounce" />
    </span>
  );
}

/** Score + PDF download card rendered inside an assistant bubble. */
function OptimizeCard({ r }: { r: OptimizeResult }) {
  const delta = r.after - r.before;
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
        <span className="text-ink-500">{r.before}</span>
        <span aria-hidden>→</span>
        <span className="text-emerald-600">{r.after}</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
          {delta >= 0 ? "+" : ""}
          {delta} pts
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {r.cvUrl ? (
          <a
            href={r.cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            ⬇ Optimized CV (PDF)
          </a>
        ) : (
          <p className="text-xs text-ink-500">The PDF couldn&apos;t be generated this time — try again.</p>
        )}
        {r.reportUrl && (
          <a
            href={r.reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-slate-50"
          >
            ⬇ Improvement report (PDF)
          </a>
        )}
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [attached, setAttached] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);
  const contextSentRef = useRef(false);
  const prevLabelRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load persisted history once, when we learn who the user is.
  useEffect(() => {
    if (!email || loadedRef.current) return;
    loadedRef.current = true;
    try {
      const raw = localStorage.getItem(storageKey(email));
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed) && parsed.length) {
          setMessages(parsed);
          if (parsed.some((m) => m.role === "user" && m.apiContent && m.apiContent !== m.content)) {
            contextSentRef.current = true;
          }
        }
      }
    } catch {
      /* corrupt storage — start fresh */
    }
  }, [email]);

  // Persist after each completed turn (not mid-stream).
  useEffect(() => {
    if (!email || busy) return;
    try {
      if (messages.some((m) => m.role === "user")) {
        localStorage.setItem(storageKey(email), JSON.stringify(messages));
      }
    } catch {
      /* quota/blocked — non-critical */
    }
  }, [messages, busy, email]);

  // Subscribe to the "résumé I'm working on" context published by pages.
  useEffect(() => {
    const sync = () => {
      const c = getChatContext();
      setCtx(c);
      if (c && c.label !== prevLabelRef.current) {
        prevLabelRef.current = c.label;
        setAttached(true);
        contextSentRef.current = false;
      }
      if (!c) prevLabelRef.current = null;
    };
    sync();
    return subscribeChatContext(sync);
  }, []);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, attaching]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function getToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session expired — please log in again.");
    return token;
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setError("That file is over 12 MB — please attach a smaller one.");
      return;
    }
    setError("");
    setAttachedFile(f);
    setOpen(true);
    inputRef.current?.focus();
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    const file = attachedFile;
    if ((!content && !file) || busy) return;

    setError("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    let token: string;
    try {
      token = await getToken();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      abortRef.current = null;
      return;
    }

    // Read an attached file into text first (shows a "Reading…" note).
    let fileBlock = "";
    const fileName = file?.name;
    if (file) {
      setAttaching(true);
      try {
        const r = await extractFile({ file, token, signal: controller.signal });
        fileBlock = `Attached file "${r.filename}":\n"""\n${r.text}\n"""\n\n`;
      } catch (e) {
        setAttaching(false);
        setBusy(false);
        abortRef.current = null;
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message || "Could not read that file.");
        }
        return;
      }
      setAttaching(false);
    }

    setInput("");
    setAttachedFile(null);
    const finalText = content || "Please review this résumé and give me your top suggestions.";

    // Attach the working résumé once per context (skip if a file was uploaded).
    let ctxBlock = "";
    if (ctx && attached && !contextSentRef.current && !file) {
      ctxBlock =
        `Here is the résumé I'm currently working on (${ctx.label}):\n"""\n` +
        `${ctx.text.slice(0, 8000)}\n"""\n\n`;
      contextSentRef.current = true;
    }

    const prefix = ctxBlock + fileBlock;
    const apiContent = prefix ? prefix + finalText : undefined;
    const userMsg: Msg = { role: "user", content: finalText, apiContent, file: fileName };

    const base: Msg[] = [...messages, userMsg];
    const firstUser = base.findIndex((m) => m.role === "user");
    const apiMessages = base
      .slice(firstUser)
      .map((m) => ({ role: m.role, content: m.apiContent ?? m.content }));

    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);

    try {
      await streamChat({
        messages: apiMessages,
        token,
        signal: controller.signal,
        onChunk: (t) =>
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + t };
            }
            return copy;
          }),
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = (err as Error).message || "Something went wrong.";
        setError(msg);
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            copy[copy.length - 1] = { ...last, content: `⚠ ${msg}` };
          }
          return copy;
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  /** Run the full ATS optimize pipeline on the attached/context résumé and post
   *  the score + downloadable PDFs back into the chat. */
  async function runOptimize() {
    if (busy) return;
    setError("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    let token: string;
    try {
      token = await getToken();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      abortRef.current = null;
      return;
    }

    // Resolve the résumé text: prefer an attached file, else the page context.
    const file = attachedFile;
    let resumeText = "";
    let source = "";
    try {
      if (file) {
        setAttaching(true);
        const r = await extractFile({ file, token, signal: controller.signal });
        resumeText = r.text;
        source = r.filename;
        setAttaching(false);
      } else if (ctx) {
        resumeText = ctx.text;
        source = ctx.label;
      } else {
        setError("Attach or paste a résumé first, then tap Optimize.");
        setBusy(false);
        abortRef.current = null;
        return;
      }
    } catch (e) {
      setAttaching(false);
      setBusy(false);
      abortRef.current = null;
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message || "Could not read that file.");
      }
      return;
    }

    setAttachedFile(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Optimize my résumé for ATS and generate the PDF.", file: file ? source : undefined },
      { role: "assistant", content: "", working: "Optimizing — scoring your résumé and building your PDF (~30s)…" },
    ]);

    try {
      const res = await analyzeResume({ jobDescription: "", resumeText, token, signal: controller.signal });
      const a = res.analysis;
      const before = Math.round(a.atsScoreBefore);
      const after = Math.round(a.atsScoreAfter);
      const top = (a.improvements || [])
        .slice(0, 3)
        .map((i) => `• ${i.area}`)
        .join("\n");
      const text =
        `Done — I ran a general ATS optimization.\n\n**ATS score: ${before} → ${after}**` +
        (top ? `\n\nTop improvements:\n${top}` : "") +
        `\n\nDownload your files below. Want it targeted to a specific job or a styled/photo template? Use the Optimizer or Studio pages.`;
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: text,
          optimize: { before, after, cvUrl: res.cvPdfUrl, reportUrl: res.reportPdfUrl },
        };
        return copy;
      });
    } catch (e) {
      const aborted = (e as Error).name === "AbortError";
      const msg = aborted ? "" : (e as Error).message || "Optimization failed — please try again.";
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.working) {
          copy[copy.length - 1] = { role: "assistant", content: msg ? `⚠ ${msg}` : "Stopped." };
        }
        return copy;
      });
      if (msg) setError(msg);
    } finally {
      setBusy(false);
      setAttaching(false);
      abortRef.current = null;
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([{ role: "assistant", content: GREETING }]);
    setError("");
    setAttachedFile(null);
    contextSentRef.current = false;
    if (ctx) setAttached(true);
    try {
      if (email) localStorage.removeItem(storageKey(email));
    } catch {
      /* ignore */
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (!email) return null;

  const showSuggestions = messages.filter((m) => m.role === "user").length === 0;
  const hasHistory = messages.some((m) => m.role === "user");
  const canSend = !!input.trim() || !!attachedFile;

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Open the résumé coach chat"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-card ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg sm:bottom-6 sm:right-6"
        >
          <BotMascot className="h-11 w-11" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Résumé coach chat"
          className="fixed inset-x-3 bottom-3 top-3 z-50 flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:max-h-[calc(100vh-6rem)] sm:w-[380px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-brand-600 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2">
              <BotMascot className="h-8 w-8 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Résumé Coach</p>
                <p className="truncate text-xs text-brand-100">AI career &amp; résumé help</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {hasHistory && (
                <button
                  type="button"
                  aria-label="Clear chat"
                  title="Clear chat"
                  onClick={clearChat}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4"
          >
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-brand-600 text-white"
                      : "border border-slate-200 bg-white text-ink-700"
                  }`}
                >
                  {m.file && <span className="mb-1 block text-xs opacity-80">📎 {m.file}</span>}
                  {m.working ? (
                    <span className="inline-flex items-center gap-2 py-0.5 align-middle">
                      <Dots />
                      <span className="text-xs text-ink-500">{m.working}</span>
                    </span>
                  ) : m.content ? (
                    renderRich(m.content)
                  ) : (
                    <span className="inline-flex items-center gap-1 py-1 align-middle">
                      <Dots />
                    </span>
                  )}
                  {m.optimize && <OptimizeCard r={m.optimize} />}
                </div>
              </div>
            ))}

            {showSuggestions && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-brand-100 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-slate-200 bg-white p-2.5">
            {ctx &&
              (attached ? (
                <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs text-brand-700">
                  <span className="min-w-0 flex-1 truncate">📎 Using {ctx.label}</span>
                  <button
                    type="button"
                    aria-label="Don't use my résumé as context"
                    onClick={() => setAttached(false)}
                    className="shrink-0 rounded p-0.5 font-bold hover:bg-brand-100"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAttached(true)}
                  className="mb-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-slate-50"
                >
                  📎 Use {ctx.label}
                </button>
              ))}

            {attachedFile && (
              <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-ink-700">
                <span className="min-w-0 flex-1 truncate">📎 {attachedFile.name}</span>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => setAttachedFile(null)}
                  className="shrink-0 rounded p-0.5 font-bold hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>
            )}
            {attaching && <p className="mb-2 px-1 text-xs text-brand-600">Reading your file…</p>}

            {(ctx || attachedFile) && (
              <button
                type="button"
                onClick={() => void runOptimize()}
                disabled={busy}
                className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ⚡ Optimize for ATS (score + PDF)
              </button>
            )}

            <div className="flex items-end gap-2">
              <button
                type="button"
                aria-label="Attach a résumé file"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-ink-700 transition hover:bg-slate-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21.44 11.05l-9.19 9.19a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={onPickFile}
              />
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Ask about your résumé…"
                className="max-h-28 min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              {busy ? (
                <button
                  type="button"
                  aria-label="Stop generating"
                  onClick={stop}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-ink-700 transition hover:bg-slate-100"
                >
                  <span className="h-3 w-3 rounded-[2px] bg-ink-700" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Send message"
                  onClick={() => void send()}
                  disabled={!canSend}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              )}
            </div>
            {error && <p className="mt-1.5 px-1 text-xs text-red-600">{error}</p>}
            <p className="mt-1.5 px-1 text-center text-[11px] text-ink-500">
              For a full scored before/after + PDF, use the Optimizer.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
