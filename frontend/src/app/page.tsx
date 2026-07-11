import Link from "next/link";
import NavBar from "@/components/NavBar";

const features = [
  {
    icon: "🎯",
    title: "Tailored to the job",
    body: "Paste any job description and your résumé is rewritten to match its keywords, tone, and priorities.",
  },
  {
    icon: "📊",
    title: "Before & after ATS score",
    body: "See exactly what was lacking, what your new CV now has, and why keyword matching improved.",
  },
  {
    icon: "📄",
    title: "Two polished PDFs",
    body: "Download an ATS-safe optimized résumé and a full diagnostic report — ready to send.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <NavBar />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
          Powered by free AI — no cost to try
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-ink-900 sm:text-6xl">
          Tailor your résumé to any job in{" "}
          <span className="text-brand-600">seconds</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-500">
          Upload your CV and a job description. Our AI rewrites it to be ATS-compliant,
          scores it before and after, and hands you two ready-to-send PDFs.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary">
            Optimize my résumé →
          </Link>
          <Link href="/login" className="btn-ghost">
            I have an account
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-2xl">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-ink-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-extrabold text-ink-900">
            How it works
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              ["1", "Upload", "Add your résumé (PDF, DOCX, image, or paste text) and the job description."],
              ["2", "AI optimizes", "Gemini rewrites for ATS + keywords, and scores the difference."],
              ["3", "Download", "Grab your new CV and the improvement report as PDFs."],
            ].map(([n, t, b]) => (
              <div key={n} className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-lg font-bold text-white">
                  {n}
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink-900">{t}</h3>
                <p className="mt-2 text-ink-500">{b}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 text-center">
            <Link href="/signup" className="btn-primary">
              Get started free
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-ink-500">
        Jobologgy AI — a résumé optimization demo. Built with Next.js, Supabase & Gemini.
      </footer>
    </main>
  );
}
