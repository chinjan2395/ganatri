# Report Design Guide

**Single source of truth for the "report-generator" agent.** This reproduces the
"Product Compass"–style infographic look: warm cream page, coral accent, bold serif
display headings, clean sans body, monospace code chips, coral numbered-step badges,
dark callout/command boxes, and a card grid with one filled coral card.

> The agent **must read this file** instead of fetching any external URL. All colors,
> fonts, sizes, and components are defined here. Single-column layout is the default.

---

## 1. Design tokens (exact values)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#FAF8F3` | Page background (warm cream, light) |
| `--surface` | `#ECE5D8` | Cream card / light callout background |
| `--surface-2` | `#E5DDCD` | Slightly deeper cream (alt cards) |
| `--line` | `#DAD3C6` | Hairline dividers, card borders |
| `--ink` | `#1C1A17` | Headings, dark boxes, footer bar, near-black text |
| `--text` | `#57534C` | Body text (warm gray) |
| `--muted` | `#8A857C` | Fine print, captions, secondary labels |
| `--accent` | `#E07B5C` | Coral: step badges, filled card, eyebrows, links, code keywords |
| `--accent-deep` | `#D2693F` | Coral hover/pressed, accent text on light bg where more contrast helps |
| `--on-dark` | `#EDE7DB` | Text on dark boxes / footer |
| `--on-dark-muted` | `#A49E92` | Muted text on dark boxes |

**Radii:** card `14px` · box `16px` · code chip `5px` · step badge `28px` circle.
**Section gap:** `32px` between major blocks. **Page padding:** `64px` top / `48px` sides
(generous top space so the header never feels cramped) · **footer band:** `60px` reserved at
the bottom of every page.

---

## 2. Typography

Load **once** in `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Role | Font | Size / weight | Notes |
|------|------|---------------|-------|
| Display title (H1) | Playfair Display | ~52px / 800 | `line-height:1.05`; accent word in `<span class="accent">` |
| Section heading (H2) | Playfair Display | ~26px / 700 | optional, for big sections |
| Eyebrow / kicker | Inter | 12px / 700 | UPPERCASE, `letter-spacing:.15em`, coral |
| Subtitle | Inter | 16px / 400 | muted; bold emphasis (`<strong>`) in ink |
| Step / card title | Inter | 17px / 700 (step), 15px / 700 (card) | ink |
| Body | Inter | 14px / 400 | `line-height:1.5`, `--text` |
| Tip line | Playfair Display *italic* | 13px / 400 italic | coral, sits under a step body |
| Fine print | Inter | 12px / 400 | `--muted` |
| Code chip / mono | JetBrains Mono | 12–13px / 500 | inline `<code>` |

---

## 3. Component catalog

Build pages by composing these. Pick components to fit the content — not every report
needs every component.

- **`.eyebrow`** — small uppercase coral kicker above a title or section.
- **`.title`** — the big serif H1. Wrap the highlighted word(s) in `<span class="accent">`.
- **`.subtitle`** — one-line gray summary under the title; emphasize with `<strong>`.
- **`.callout`** — light cream info box, full width by default. This is the **default** — use it
  for context, summaries, takeaways, anything routine. Use `.callout.callout--dark` (ink
  background) **sparingly, only for genuinely critical/warning content** (e.g. a blocking risk,
  a hard deadline, a breaking change) — it should stand out because it's rare, not because every
  report uses one. `.callout-row` (two callouts side by side) is **optional**, only reach for it
  when you truly have two short, parallel things to contrast — a single full-width `.callout`
  is the normal case.
- **`.steps` › `.step`** — numbered list. Each `.step` has a coral `.step__num` circle,
  a `.step__title`, `.step__body`, and optional `.step__tip` (serif italic coral).
- **`.feature`** — dark rounded box for "commands / key figures". Reserve this for **must-not-
  miss information** (critical metrics, blocking issues) — don't reach for it as a default way
  to present a metrics list; a `.callout` or plain text list is usually the better, lighter choice.
- **`.cards` › `.card`** — multi-column card grid. **Use a single light callout or a plain stacked
  list by default; only switch to a 2-column `.cards` grid when content is genuinely a small set
  of parallel, comparable items** (e.g. exactly 2–3 short highlights) — don't default to columns
  for the sake of it. Add `.card--accent` for at most one filled coral card when used.
  Each card: `.card__icon`, `.card__title`, `.card__body`, inline `<code>` chips.
- **`<code>`** — inline monospace chip (works on light and dark backgrounds).
- **`.note`** — footer note row with a leading arrow `→`.
- **Page-number footer** — a coral page number (`1 / 2`) centered in the reserved bottom margin
  of **every** printed page, no bar/background, no other text. Rendered natively via the `@page`
  margin-box rule in the skeleton — content authors never write footer markup by hand.
- **Page-break behavior** — every component (`.callout-row`, `.step`, `.feature`, `.cards`,
  `.card`, `.note`) has `break-inside:avoid` so it never splits across two pages: if it doesn't
  fit in the remaining space, the whole block moves to the next page. `.section-eyebrow` also
  has `break-after:avoid` so a section heading never strands alone at the bottom of a page.

---

## 4. Ready-to-clone HTML skeleton

Copy this whole file, then replace the content between the `<!-- CONTENT -->` markers.
Keep the `<style>` block intact. Critical print rules (`print-color-adjust`, `@page`) are
already included — **do not remove them** or the PDF will lose its backgrounds.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>REPORT TITLE</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#FAF8F3; --surface:#ECE5D8; --surface-2:#E5DDCD; --line:#DAD3C6;
    --ink:#1C1A17; --text:#57534C; --muted:#8A857C;
    --accent:#E07B5C; --accent-deep:#D2693F; --on-dark:#EDE7DB; --on-dark-muted:#A49E92;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  /* Reserve a 60px band at the bottom of EVERY printed page for the page-number footer,
     via the @page margin box (native CSS Paged Media — Chrome renders this natively,
     repeating correctly on every page with an accurate, auto-incrementing page number).
     Keep this margin — content needs clear air above the footer, not just enough room
     for the number itself — but it doesn't need to be large. */
  @page{ size:A4; margin:0 0 60px 0; }
  @page{
    @bottom-center{
      content: counter(page) " / " counter(pages);
      color:var(--accent);
      font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:500;
      letter-spacing:.05em;
    }
  }
  html,body{ background:var(--bg); }
  body{
    font-family:'Inter',system-ui,sans-serif; color:var(--text);
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
    font-size:14px; line-height:1.5;
  }
  .page{ max-width:760px; margin:0 auto; padding:64px 48px 0; }

  /* header — generous top space so the title never feels cramped against the page edge */
  .eyebrow{ font-size:12px; font-weight:700; letter-spacing:.15em; text-transform:uppercase;
            color:var(--accent); text-align:center; }
  .title{ font-family:'Playfair Display',Georgia,serif; font-weight:800; font-size:52px;
           line-height:1.05; color:var(--ink); text-align:center; margin:14px 0 16px; }
  .title .accent{ color:var(--accent); }
  .subtitle{ font-size:16px; color:var(--muted); text-align:center; max-width:560px;
             margin:0 auto 8px; }
  .subtitle strong{ color:var(--ink); font-weight:700; }

  /* section kicker (left aligned) — never let it strand alone at the bottom of a page */
  .section-eyebrow{ font-size:12px; font-weight:700; letter-spacing:.15em;
                    text-transform:uppercase; color:var(--accent); margin:32px 0 16px;
                    break-after:avoid; page-break-after:avoid; }
  h2.section{ font-family:'Playfair Display',serif; font-weight:700; font-size:26px;
              color:var(--ink); margin:0 0 16px; }

  /* callouts */
  .callout-row{ display:flex; gap:14px; margin-top:24px;
                break-inside:avoid; page-break-inside:avoid; }
  .callout{ flex:1; background:var(--surface); border-radius:14px; padding:16px 18px;
            font-size:13px; line-height:1.5; }
  .callout strong{ color:var(--ink); }
  .callout .accent{ color:var(--accent-deep); font-weight:700; }
  .callout--dark{ background:var(--ink); color:var(--on-dark); }
  .callout--dark .accent{ color:var(--accent); font-weight:700; }

  /* numbered steps — each step stays whole; only the .step breaks between, never inside */
  .steps{ margin-top:8px; }
  .step{ display:flex; gap:14px; padding:16px 0; border-bottom:1px solid var(--line);
         break-inside:avoid; page-break-inside:avoid; }
  .step:last-child{ border-bottom:0; }
  .step__num{ flex:0 0 28px; width:28px; height:28px; border-radius:50%;
              background:var(--accent); color:#fff; font-weight:700; font-size:13px;
              display:flex; align-items:center; justify-content:center; }
  .step__title{ font-size:17px; font-weight:700; color:var(--ink); margin-bottom:4px; }
  .step__body{ font-size:14px; color:var(--text); }
  .step__tip{ font-family:'Playfair Display',serif; font-style:italic; font-size:13px;
              color:var(--accent-deep); margin-top:6px; }

  /* dark feature / command box */
  .feature{ background:var(--ink); color:var(--on-dark); border-radius:16px;
            padding:22px 24px; margin-top:24px;
            break-inside:avoid; page-break-inside:avoid; }
  .feature__head{ font-family:'Inter',sans-serif; font-weight:700; font-size:18px;
                  color:#fff; margin-bottom:16px; }
  .feature__grid{ display:grid; grid-template-columns:auto 1fr; gap:10px 18px; }
  .feature__row{ display:contents; }
  .feature__row .term{ color:var(--accent); font-family:'JetBrains Mono',monospace;
                       font-size:13px; }
  .feature__row .desc{ color:var(--on-dark-muted); font-size:13px; }

  /* card grid — the whole grid stays together; if it can't fit, it moves to the next page */
  .cards{ display:grid; grid-template-columns:repeat(2,1fr); gap:14px; margin-top:16px;
          break-inside:avoid; page-break-inside:avoid; }
  .card{ background:var(--surface); border-radius:14px; padding:18px 20px;
         break-inside:avoid; page-break-inside:avoid; }
  .card--accent{ background:var(--accent); color:#fff; }
  .card__icon{ font-size:20px; margin-bottom:10px; }
  .card__title{ font-size:15px; font-weight:700; color:var(--ink); margin-bottom:6px; }
  .card--accent .card__title{ color:#fff; }
  .card__body{ font-size:13px; line-height:1.5; color:var(--text); }
  .card--accent .card__body{ color:#FFF1EA; }

  /* inline code chip */
  code{ font-family:'JetBrains Mono',monospace; font-size:.92em; background:var(--surface-2);
        color:var(--ink); padding:1px 6px; border-radius:5px; }
  .callout--dark code, .feature code, .card--accent code{
        background:rgba(255,255,255,.14); color:#fff; }

  /* footer note row (inline, part of content — not the page-number footer) */
  .note{ display:flex; gap:10px; align-items:flex-start; color:var(--muted); font-size:12px;
         margin:32px 0 24px; break-inside:avoid; page-break-inside:avoid; }
  .note .arrow{ color:var(--accent); font-weight:700; }
</style>
</head>
<body>
  <!-- CONTENT START -->
  <div class="page">

    <div class="eyebrow">YOUR EYEBROW / KICKER</div>
    <h1 class="title">Main Title With <span class="accent">Accent Words</span></h1>
    <p class="subtitle">One-line summary with a <strong>bold highlight</strong> for the key fact.</p>

    <!-- Default: a single full-width light callout for context/summary. -->
    <div class="callout"><strong>Context box.</strong> Background info goes here in plain text.</div>

    <!-- Only if there's genuinely critical/warning content, add ONE dark callout — sparingly:
    <div class="callout callout--dark">Critical: <span class="accent">accent keywords</span> for the one thing that must not be missed.</div>
    -->

    <div class="section-eyebrow">SECTION LABEL</div>
    <div class="steps">
      <div class="step">
        <div class="step__num">1</div>
        <div>
          <div class="step__title">Step title</div>
          <div class="step__body">Step description. Inline <code>code</code> renders as a chip.</div>
          <div class="step__tip">Optional italic tip line.</div>
        </div>
      </div>
      <div class="step">
        <div class="step__num">2</div>
        <div>
          <div class="step__title">Second step</div>
          <div class="step__body">More detail here.</div>
        </div>
      </div>
    </div>

    <div class="feature">
      <div class="feature__head">&gt;_ Key figures / commands</div>
      <div class="feature__grid">
        <div class="feature__row"><span class="term">metric-a</span><span class="desc">What it means</span></div>
        <div class="feature__row"><span class="term">metric-b</span><span class="desc">What it means</span></div>
      </div>
    </div>

    <!-- Only switch to a 2-column .cards grid when there are 2-3 genuinely parallel,
    comparable items — otherwise prefer a plain list or stacked single callouts. -->
    <div class="section-eyebrow">HIGHLIGHTS</div>
    <div class="cards">
      <div class="card card--accent">
        <div class="card__icon">★</div>
        <div class="card__title">Featured card</div>
        <div class="card__body">The single filled coral card draws the eye to the top item.</div>
      </div>
      <div class="card">
        <div class="card__icon">◆</div>
        <div class="card__title">Standard card</div>
        <div class="card__body">Cream card with a title and short body. Use <code>chips</code> as needed.</div>
      </div>
    </div>

    <div class="note"><span class="arrow">→</span><span>Footnote / "not covered here" line in muted text.</span></div>
  </div>
  <!-- CONTENT END -->
  <!-- No manual footer markup: the page-number footer is rendered natively by the
       @page margin-box rule above on every printed page. Do not add a footer div here. -->
</body>
</html>
```

---

## 5. Rendering to PDF (system Chrome, no npm deps)

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=10000 \
  --print-to-pdf="<abs>/reports/<slug>-<ts>.pdf" \
  "file://<abs>/reports/<slug>-<ts>.html"
```

- `--virtual-time-budget=10000` gives Google Fonts time to load before printing.
- `--no-pdf-header-footer` removes Chrome's own date/URL header/footer — the `@page` margin-box
  rule in the skeleton renders our own instead.
- `@page { size:A4; margin:0 0 60px 0 }` + the `@bottom-center` margin-box rule (already in the
  skeleton) reserve a 60px clear band at the bottom of **every** printed page — small, but still
  enough breathing room above the footer — and fill it with a centered, coral, auto-incrementing
  page number (`counter(page) / counter(pages)`) in an 11px mono font. No background bar — the
  footer sits directly on the page background. Chrome supports this natively, no JavaScript
  required. **Don't shrink this margin further** or content crowds the footer.
- `.page{ padding:64px 48px 0 }` gives the header (eyebrow/title/subtitle) generous top space
  so it never feels cramped against the page edge.
- The footer shows **only** the page number (e.g. `1 / 1`, `2 / 3`) in coral — no titles, dates,
  bars, or URLs.
- Components carry `break-inside:avoid` (see §3) so nothing is ever split half-on-one-page,
  half-on-the-next — a component that doesn't fit moves to the next page whole.
- `print-color-adjust:exact` on `body` (already in the skeleton) keeps the full-bleed cream
  background and coral/dark fills from being stripped in the PDF. **Never remove it.**
