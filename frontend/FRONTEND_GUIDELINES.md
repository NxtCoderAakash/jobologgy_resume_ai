# Jobologyy — Frontend Guidelines

The written standard every page and component in `frontend/src` must satisfy. It is
**mobile-first** and grounded in the project's own design tokens
(`tailwind.config.ts`, `globals.css`) plus WCAG 2.1 AA. Each rule has an ID so audits
can reference it (e.g. "fails R2"). Treat this as a checklist before shipping any UI
change.

---

## 0. Design tokens (single source of truth)

Never hard-code hex/px that a token already covers.

| Token | Value | Use |
|---|---|---|
| `brand-50/100/500/600/700` | `#eff6ff … #1d4ed8` | primary blue: CTAs, active nav, links, accents |
| `ink-900/700/500` | `#0f172a / #334155 / #64748b` | text: headings / body / muted |
| `slate-*` | Tailwind default | borders (`slate-200`), backgrounds (`slate-50/100`) |
| `font-sans` | Inter → system-ui | all text |
| `shadow-card` | soft double shadow | cards, popovers, dropdowns |
| `rounded-2xl` | 1rem | cards |

Semantic state colors (consistent everywhere): success `emerald-*`, warning `amber-*`,
error/danger `red-*`, "best-for-humans/creative" `fuchsia/violet-*`.

---

## 1. Breakpoints & mobile-first (R1)

- **Author base styles for the smallest screen**, then layer up with `sm:` `md:` `lg:`.
  Never write desktop-first and patch mobile.
- Tailwind breakpoints: `sm 640` · `md 768` · `lg 1024` · `xl 1280`.
- Every screen must be verified at **375px, 768px, 1280px** minimum before shipping.
- Semantic breakpoint use in this app:
  - `< md` = phone layout (single column, hamburger nav, stacked forms/preview).
  - `md` = tablet (2-column where it fits).
  - `lg` = desktop (full multi-column, side rails, sticky preview).

## 2. No horizontal overflow — ever (R2) — *highest priority*

The page must **never** scroll sideways at any breakpoint:
`document.documentElement.scrollWidth <= window.innerWidth`.

Root causes and the required guards:

- **CSS Grid:** every `grid` MUST declare a column template at the base breakpoint —
  use `grid-cols-1` (→ `minmax(0,1fr)`) on mobile. An `auto` track with no template
  grows to its content's *max-content* and blows past the viewport.
  *(This is the exact bug that shipped in the Studio editor.)*
- **Flex/grid children that truncate or hold long text** need `min-w-0` (flex/grid items
  default to `min-width:auto`, which refuses to shrink below content).
- Wide, unavoidable content (tables, code, wide diagrams, résumé sheets) lives inside an
  `overflow-x-auto` (or `overflow-hidden` for a fixed sheet) container — never the page body.
- Long unbroken strings (URLs, emails) → `break-words` / `truncate`, or let them wrap.
- Fixed pixel widths (`w-[600px]`) must be paired with `max-w-full`.

## 3. Layout & spacing (R3)

- Page container padding scales: `px-4` → `sm:px-6` → `lg:px-12`. Vertical `py-6`/`py-10`.
- Full-width app shell (no fixed centered gutter) — content spreads edge-to-edge with the
  padding above, matching the "industry standard" (Google/Apple) look the product wants.
- Card padding scales: `p-4` on mobile → `sm:p-6`. Don't ship `p-6`-only cards (cramped on phones).
- Use consistent gaps (`gap-3/4/6`), not ad-hoc margins, inside flex/grid clusters.

## 4. Typography (R4)

- One responsive scale, mobile value first:
  - Page `h1`: `text-2xl font-extrabold sm:text-3xl`
  - Section `h2`: `text-lg`/`text-xl font-bold`
  - Body: `text-sm`/`text-base`; muted helper: `text-xs`/`text-sm text-ink-500`
- Line length stays readable; long prose blocks cap around `max-w-prose` where used.
- Never rely on font size below `text-xs` (12px) for anything the user must read.

## 5. Touch targets & pointer (R5)

- Any tappable control (button, link-as-button, icon button, checkbox row) has a **≥44×44px**
  hit area (WCAG 2.5.5 / Apple HIG). Icon-only buttons: `h-11 w-11` (44px) on touch;
  `h-10 w-10` is the hard floor and only for dense desktop toolbars.
- Provide spacing between adjacent tap targets so they aren't mis-tapped.
- `.btn-primary`/`.btn-ghost` already give `px-5 py-3` (~44px tall) — prefer them.

## 6. Color & contrast (R6)

- Body/interactive text meets **WCAG AA 4.5:1**; large text (≥18.66px bold / 24px) meets 3:1.
- `ink-900`/`ink-700` on white pass easily. `ink-500` (#64748b) on white ≈ 4.6:1 — OK for
  normal text but **do not** put `ink-500` on colored/tinted backgrounds without re-checking.
- Never encode meaning by color alone — pair with text/icon (e.g. "✓ added", "⚠ missing").

## 7. Accessibility (R7)

- Semantic elements: `<header> <nav> <main> <button> <ul>`; headings in order.
- Every interactive element is keyboard-reachable and has a **visible focus ring**
  (`focus:ring-2 focus:ring-brand-100` per `.input`, or `focus-visible` on buttons).
- Icon-only / toggle controls need `aria-label`; disclosure controls need
  `aria-expanded` + `aria-controls`; active nav gets `aria-current`.
- All `<img>` have meaningful `alt` (or `alt=""` if purely decorative).
- Dialogs/menus: closeable via **Escape** and outside-click; focus is sensible.

## 8. Motion (R8)

- Honor `@media (prefers-reduced-motion: reduce)` — disable or reduce non-essential
  animation (scanner beam, mascot blink already gated). New animations must add the guard.
- Keep transitions ≤300ms for UI feedback; avoid layout-shifting animation.

## 9. Component states (R9)

Every data-driven view handles all four: **loading** (skeleton/progress),
**empty** (helpful placeholder, not a blank box), **error** (plain message + recovery),
**success/normal**. Async actions disable their trigger and show progress.

## 10. Navigation (R10)

- Mobile-first: when the nav can't fit one comfortable row, collapse the secondary items
  into a **hamburger dropdown** rather than shrinking text into overlap or a sideways scroll.
  Keep brand + primary CTA visible.
- Active route is visually indicated and carries `aria-current="page"`.

## 11. Forms (R11)

- Every field has a `<label>` (`.label`) tied to it; placeholders are hints, not labels.
- Inputs use `.input` (consistent border, focus ring, 44px height). Errors shown inline
  near the field, in `red-*`, with text (not color alone).
- Primary action is a real `<button type="submit">`; disable while submitting.

## 12. Performance (R12)

- Lazy-load heavy/optional libraries (e.g. `pdfjs-dist` is dynamically imported only when a
  PDF preview is needed). Don't pull big deps into the shared bundle.
- Images sized/resized before upload (`lib/photo.ts`); use `object-cover` + fixed box to
  avoid layout shift.

---

### Pre-ship checklist (run every time)

- [ ] Verified at 375 / 768 / 1280 px
- [ ] `scrollWidth <= innerWidth` at all three (R2)
- [ ] All new grids have `grid-cols-1` base; truncating flex kids have `min-w-0` (R2)
- [ ] Tap targets ≥44px (R5)
- [ ] Headings/text use the responsive scale (R4)
- [ ] Icon buttons/toggles have aria-label / aria-expanded; focus ring visible (R7)
- [ ] Images have alt (R7)
- [ ] New animation gated by prefers-reduced-motion (R8)
- [ ] Loading / empty / error states present (R9)
