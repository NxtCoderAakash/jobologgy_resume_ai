"use client";

/**
 * OAuth return landing. Supabase (detectSessionInUrl) exchanges the `?code`
 * for a session as the client initializes; we wait for that session, then send
 * the user into the app. Kept separate from /login and /app so the code
 * exchange can't race their auth guards.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) router.replace("/app");
    });

    // The code exchange may resolve a beat later — catch SIGNED_IN too.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active && session) router.replace("/app");
    });

    // If nothing arrives, the provider likely isn't configured or the user cancelled.
    const timeout = setTimeout(() => {
      if (active) setError("Sign-in didn't complete. Please try again.");
    }, 10000);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      {error ? (
        <div className="text-center">
          <p className="text-ink-700">{error}</p>
          <a href="/login" className="mt-3 inline-block font-semibold text-brand-600">
            Back to login
          </a>
        </div>
      ) : (
        <p className="text-ink-500">Signing you in…</p>
      )}
    </main>
  );
}
