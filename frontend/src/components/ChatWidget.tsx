"use client";

/**
 * Floating résumé/career coach — a chat bubble available on every page once the
 * user is logged in. Streams replies from POST /api/chat. Mobile-first and
 * overflow-safe per FRONTEND_GUIDELINES (R2/R5/R7).
 *
 * - History persists per user in localStorage (survives reload).
 * - Context-aware: if a page (Studio/Optimizer/Analyzer) publishes the résumé
 *   the user is working on, the coach can use it without pasting.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { streamChat, type ChatMessage } from "@/lib/chatApi";
import { getChatContext, subscribeChatContext, type ChatContext } from "@/lib/chatContext";

const GREETING =
  "Hi! I'm your résumé coach. Paste a résumé or a bullet point and I'll sharpen it, compare it to a job description, or help you prep for interviews. What are you working on?";

const SUGGESTIONS = [
  "Review my résumé",
  "Rewrite a bullet point with impact",
  "Write a professional summary",
  "Interview prep tips",
];

/** A turn. `apiContent` (when set) is sent to the model instead of `content`,
 *  letting us attach the user's résumé without showing the dump in the bubble. */
interface Msg extends ChatMessage {
  apiContent?: string;
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

export default function ChatWidget() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [attached, setAttached] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadedRef = useRef(false);
  const contextSentRef = useRef(false);
  const prevLabelRef = useRef<string | null>(null);

  // Only show the coach to logged-in users.
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

  // Auto-scroll to the newest content as it streams.
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

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

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setError("");

    // Attach the working résumé once per context (kept in history via apiContent).
    let apiContent: string | undefined;
    if (ctx && attached && !contextSentRef.current) {
      apiContent =
        `Here is the résumé I'm currently working on (${ctx.label}):\n"""\n` +
        `${ctx.text.slice(0, 8000)}\n"""\n\n${content}`;
      contextSentRef.current = true;
    }
    const userMsg: Msg = { role: "user", content, apiContent };

    const base: Msg[] = [...messages, userMsg];
    const firstUser = base.findIndex((m) => m.role === "user");
    const apiMessages = base
      .slice(firstUser)
      .map((m) => ({ role: m.role, content: m.apiContent ?? m.content }));

    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getToken();
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

  function clearChat() {
    abortRef.current?.abort();
    setMessages([{ role: "assistant", content: GREETING }]);
    setError("");
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

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Open the résumé coach chat"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-card transition hover:bg-brand-700 sm:bottom-6 sm:right-6"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
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
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">Résumé Coach</p>
              <p className="truncate text-xs text-brand-100">AI career &amp; résumé help</p>
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
                  {m.content ? (
                    renderRich(m.content)
                  ) : (
                    <span className="inline-flex gap-1 py-1 align-middle">
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-500 motion-safe:animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-500 motion-safe:animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-500 motion-safe:animate-bounce" />
                    </span>
                  )}
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

            <div className="flex items-end gap-2">
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
                  disabled={!input.trim()}
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
