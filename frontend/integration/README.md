# Drop-in integration module

A single self-contained React component (`ResumeOptimizer`) + a tiny API client that add the
"AI Resume Optimizer" feature to **any** Next.js / React app — whether your codebase is
**TypeScript or JavaScript**.

It uses **inline styles only** (no Tailwind or global CSS required), so it renders correctly no
matter your host app's styling setup.

## Which folder do I copy?

| Your app is… | Copy this folder |
|--------------|------------------|
| **TypeScript** (`.tsx`) | [`ts/`](ts/) |
| **JavaScript** (`.jsx`) | [`js/`](js/) |

Both contain identical runtime logic — the `js/` copy is just the `ts/` copy with type annotations
removed.

## Usage

1. Copy the chosen folder into your app (e.g. `src/features/resume-optimizer/`).
2. Ensure the backend from this repo is running and reachable.
3. Render the component, passing your backend URL and the current user's Supabase access token
   (JWT). Get the token however your app already does auth.

### TypeScript

```tsx
import { ResumeOptimizer } from "@/features/resume-optimizer/ResumeOptimizer";
import { supabase } from "@/lib/supabaseClient";

export default function Page() {
  return (
    <ResumeOptimizer
      backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL!}
      getToken={async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? "";
      }}
    />
  );
}
```

### JavaScript

```jsx
import { ResumeOptimizer } from "@/features/resume-optimizer/ResumeOptimizer";
import { supabase } from "@/lib/supabaseClient";

export default function Page() {
  return (
    <ResumeOptimizer
      backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL}
      getToken={async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token || "";
      }}
    />
  );
}
```

## Just want the API call?

If you'd rather build your own UI, use only the API client:

```ts
import { analyzeResume } from "./api";

const result = await analyzeResume({
  backendUrl,
  token,
  jobDescription,
  file,        // File | null
  resumeText,  // optional string
});
// result: { jobId, analysis, cvPdfUrl, reportPdfUrl }
```

> Note: the **backend is the true integration point** and is language-agnostic — any frontend can
> call `POST /api/analyze` directly. This module is just a convenience wrapper + ready UI.
