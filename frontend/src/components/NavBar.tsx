"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import BotMascot from "@/components/BotMascot";
import Logo from "@/components/Logo";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm ${
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="flex flex-nowrap items-center justify-between gap-x-2 px-3 py-2.5 sm:px-6 sm:py-4 lg:px-12">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 whitespace-nowrap text-sm font-extrabold text-ink-900 sm:gap-2 sm:text-base"
          >
            <Logo className="h-7 w-7 shrink-0 sm:h-9 sm:w-9" />
            Jobologyy<span className="text-brand-600">AI</span>
          </Link>
          <BotMascot className="h-7 w-7 sm:h-9 sm:w-9" />
        </div>
        <nav className="flex flex-nowrap items-center gap-1 overflow-x-auto text-sm sm:gap-3">
          {email ? (
            <>
              <NavLink href="/analyzer">Analyzer</NavLink>
              <NavLink href="/app">Optimizer</NavLink>
              <NavLink href="/builder">
                <span className="sm:hidden">Studio</span>
                <span className="hidden sm:inline">Résumé Studio</span>
              </NavLink>
              <span className="hidden max-w-[220px] truncate text-ink-500 lg:inline">{email}</span>
              <button
                onClick={signOut}
                className="btn-ghost whitespace-nowrap px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="whitespace-nowrap px-2 py-1.5 text-xs font-semibold text-ink-700 hover:text-brand-600 sm:text-sm"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="btn-primary whitespace-nowrap px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
