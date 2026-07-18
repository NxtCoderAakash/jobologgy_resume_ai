"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import BotMascot from "@/components/BotMascot";
import Logo from "@/components/Logo";

function NavLink({
  href,
  children,
  onClick,
  block,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  /** Full-width row styling for the mobile dropdown menu. */
  block?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg font-semibold transition ${
        block ? "block px-3 py-2.5 text-base" : "whitespace-nowrap px-3 py-1.5 text-sm"
      } ${
        active
          ? "bg-brand-50 text-brand-700"
          : "text-ink-700 hover:bg-slate-100 hover:text-brand-600"
      }`}
    >
      {children}
    </Link>
  );
}

export default function NavBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on click outside the header or on Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur"
    >
      <div className="flex items-center justify-between gap-x-2 px-4 py-2.5 sm:px-6 sm:py-4 lg:px-12">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 whitespace-nowrap text-base font-extrabold text-ink-900 sm:gap-2"
          >
            <Logo className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            Jobologyy<span className="text-brand-600">AI</span>
          </Link>
          <BotMascot className="h-8 w-8 sm:h-9 sm:w-9" />
        </div>

        {/* Desktop nav (md and up) */}
        <nav className="hidden items-center gap-2 md:flex lg:gap-3">
          {email ? (
            <>
              <NavLink href="/analyzer">Analyzer</NavLink>
              <NavLink href="/app">Optimizer</NavLink>
              <NavLink href="/builder">Résumé Studio</NavLink>
              <span className="hidden max-w-[200px] truncate text-sm text-ink-500 lg:inline">
                {email}
              </span>
              <button
                onClick={signOut}
                className="btn-ghost whitespace-nowrap px-4 py-2 text-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="whitespace-nowrap px-3 py-1.5 text-sm font-semibold text-ink-700 hover:text-brand-600"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="btn-primary whitespace-nowrap px-4 py-2 text-sm"
              >
                Get started
              </Link>
            </>
          )}
        </nav>

        {/* Mobile controls (below md): hamburger when logged in, CTAs when logged out */}
        <div className="flex items-center gap-2 md:hidden">
          {email ? (
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-ink-700 transition hover:bg-slate-100"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                {open ? (
                  <>
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="whitespace-nowrap px-2 py-1.5 text-sm font-semibold text-ink-700 hover:text-brand-600"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="btn-primary whitespace-nowrap px-3 py-1.5 text-sm"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile dropdown menu (logged in only) */}
      {email && open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full border-t border-slate-200 bg-white px-4 py-3 shadow-lg md:hidden"
        >
          <nav className="flex flex-col gap-1">
            <NavLink href="/analyzer" block onClick={() => setOpen(false)}>
              Analyzer
            </NavLink>
            <NavLink href="/app" block onClick={() => setOpen(false)}>
              Optimizer
            </NavLink>
            <NavLink href="/builder" block onClick={() => setOpen(false)}>
              Résumé Studio
            </NavLink>
          </nav>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 truncate px-3 text-xs text-ink-500">{email}</p>
            <button
              onClick={signOut}
              className="btn-ghost w-full justify-center py-2.5 text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
