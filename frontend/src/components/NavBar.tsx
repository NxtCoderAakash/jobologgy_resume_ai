"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 font-semibold transition ${
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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-ink-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            ✦
          </span>
          Jobologgy<span className="text-brand-600">AI</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {email ? (
            <>
              <NavLink href="/analyzer">Analyzer</NavLink>
              <NavLink href="/app">Optimizer</NavLink>
              <NavLink href="/builder">Résumé Studio</NavLink>
              <span className="hidden text-ink-500 sm:inline">{email}</span>
              <button onClick={signOut} className="btn-ghost px-4 py-2">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="font-semibold text-ink-700 hover:text-brand-600">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary px-4 py-2">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
