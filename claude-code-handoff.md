# Case Calculator — Build Handoff for Claude Code

## What this is

A lead-generation website for a California employment law lead-gen company (separate business entity from an existing law firm). Visitors answer questions about a potential employment law situation (discrimination, retaliation, and/or harassment), receive a general dollar-range estimate, and submit their contact info. Every submission should trigger an email to the business owner with the full case details — no database, no login, no dashboard for this version. Just a working, deployed calculator that emails leads.

**A complete, ready-to-deploy project folder is attached alongside this document** (`case-calculator-site/`), containing `index.html` (the full front-end), `api/submit-lead.js` (the working email backend), `.env.example`, and a `README.md` with plain-English deployment steps. This is not a rough prototype to rebuild — it's the actual site, front-end and backend both, already written and internally tested for syntax correctness. Read through the inline comments carefully — they explain the reasoning behind several decisions (why certain questions are ordered a certain way, why the scoring uses a skewed curve, why "not sure" options score the way they do, why the email backend is structured the way it is, etc.).

Do not redesign, simplify, or "improve" the flow, copy, or visual system without asking first — every detail was deliberately decided through extensive back-and-forth. This is a handoff of a finished spec, not a rough draft to reinterpret.

---

## Tech stack (already decided, do not substitute)

- **Hosting/deployment:** Vercel
- **Framework:** Your choice of a lightweight React/Next.js setup is fine, or keep it as vanilla HTML/JS matching the prototype exactly — whichever lets you preserve the prototype's exact behavior most reliably and deploys cleanly to Vercel. If you do rebuild in a framework, the visual output and interaction behavior must be pixel/behavior-identical to the prototype.
- **Email sending:** Resend (API key will be provided separately, never hardcoded — store as an environment variable, e.g. `RESEND_API_KEY`, configured in Vercel's project settings, not committed to source control)
- **Database:** None for this version. Do not add Supabase, Firebase, or any other database. Leads are captured via email only. (This may change in a future phase — leave the code reasonably easy to extend later, but don't build for it now.)
- **Domain:** Already purchased by the site owner. Once the project is deployed to Vercel, help connect the custom domain via Vercel's domain settings (DNS records the owner will need to add at their domain registrar).

---

## The business model (context, not something to build UI for)

Flat-fee-per-lead lead generation company, structurally separate from any law firm, serving California employment law claims (discrimination, retaliation, harassment under FEHA). The calculator is the top-of-funnel hook; leads are sold to plaintiff-side attorneys. This context matters for tone and legal-disclaimer language throughout the site — everything should read as general/educational information, never as a specific legal opinion or guarantee about any individual's case. Do not add urgency-pressure language, guaranteed-outcome language, or anything resembling a specific dollar promise beyond the tiered estimate mechanism already built.

---

## Full user flow (in order)

1. **Opening screen (merged hook + first question):** Ledger-tape digit readout animation (ticks through random digits, settles on dashes) at the top, immediately followed by the first real question: "What happened to you?" — a multi-select (checkbox-style) category picker with three options: Discrimination, Retaliation, Harassment. Continue button is disabled until at least one is selected. No separate "landing page" or "Begin" button — this IS the first screen.

2. **Already-represented gate:** "Are you currently working with a lawyer on this matter?" — Yes/No. If Yes → hard stop (show a stop screen, no lead captured, no continue).

3. **Statute of limitations gate:** "When did the most recent incident happen?" — options for within 1 year / 1-2 years / 2-3 years / more than 3 years. If "more than 3 years" → hard stop (claim likely time-barred under California's 3-year FEHA filing window).

4. **FEHA employee-count gate — CONDITIONAL LOGIC, IMPORTANT:** Only asked if Discrimination and/or Retaliation was selected in step 1. Skipped entirely if only Harassment was selected, because California's FEHA harassment protections have no minimum employee-count threshold (only discrimination/retaliation claims require 5+ employees). Options: "5 or more" / "Fewer than 5" / "I'm not sure". If "Fewer than 5" is selected: remove Discrimination and Retaliation from the active category list. If Harassment was ALSO selected, the flow continues with only the harassment track. If Harassment was NOT selected, hard stop (no active categories remain).

5. **Shared background questions (asked once, regardless of how many categories were selected):**
   - Tenure ("How long did you work there?")
   - Company size ("What's the rough size of the company?")
   - Employment status/contract type ("What's your employment status?" — at-will / union-CBA / individual contract / not sure)
   - Documentation ("Do you have any documentation of what happened?" — several things saved / a little / none / not sure)

6. **Category-specific question tracks — only for categories still active after the FEHA gate.** If multiple categories are active, ask each full track back-to-back (in the order: Discrimination, then Retaliation, then Harassment). Each screen shows an eyebrow label naming its section ("Discrimination," "Retaliation," "Harassment," "Background," "Eligibility") so it's always clear which section the user is in — this matters specifically because multi-category selections mean questions from different tracks appear in sequence, and the section label is what keeps that legible.

   **Discrimination track (in this order):** protected class (disability listed FIRST in the options, then race/national origin, sex/gender/pregnancy, age, religion, something else, not sure) → adverse action severity (fired/demoted/pay-hours cut/other/not sure) → timeline (how soon after employer learned) → comparator evidence (were others treated better) → performance history (prior discipline)

   **Retaliation track (in this order):** protected activity (what was reported) → who it was reported to → adverse action severity → timing (how soon after reporting) → comparator (were non-reporters treated better) → employer's explanation (was one given, did it seem pretextual)

   **Harassment track (in this order):** type of harassment (sexual vs. other protected-trait-based, with a "not sure how to categorize" option) → severity/frequency → harasser role (supervisor/coworker/both) → job impact (fired/demoted/quit/still employed — four options, since harassment doesn't always end in a job action) → work impact (did it affect ability to do the job)

   Every question that realistically could have an "I don't know" answer includes a "Not sure" option. These score low/neutral points rather than zero — not knowing something isn't evidence against the case, it's just missing information.

7. **Scoring and estimate reveal:** Point-weighted scoring, summed across every question actually asked for that person's specific path, normalized as a percentage of the maximum possible points for that path (since path length varies with how many categories were selected). That percentage is passed through a skew curve (currently `Math.pow(pct, 1.6)`) before mapping to one of 9 tiers — this skew is intentional and important: a flat linear mapping put too many ordinary/moderate answer combinations into unrealistically high tiers, so the curve requires a genuinely strong combination of answers to reach the top tiers.

   The 9 tiers, low to high: Low/Mid/High five figures, Low/Mid/High six figures, Low/Mid/High seven figures. The number actually displayed to the user is the **midpoint** of that tier's dollar range (not the floor), except the top tier ("High seven figures") which has no ceiling and displays as its floor value with a "+" (e.g., "$5,600,000+"). This midpoint logic matters — showing a tier's floor value made "High six figures" display a number that read as barely-six-figures, which didn't match the label; the midpoint fixes that.

   The estimate number displays with the same ledger-tape digit-tick animation used on the opening screen, but ticks to the real formatted number instead of settling on dashes.

8. **Reveal + contact capture — ONE SCREEN, not two:** The estimate (with the digit animation) appears at the top of this screen, followed immediately by a centered sub-header ("Have a lawyer call you" / "Where should they reach you?" / "Free, with no obligation. A lawyer will call you within a business day.") and then the contact form directly below with no significant scroll gap: Full name, Phone number (before email), Email address, and an optional free-text box ("Anything else the attorney should know?") for the person to add details in their own words. This free-text field does NOT affect the score or tier — it's pure enrichment for whoever calls the lead. Below the form: a TCPA-style consent disclosure paragraph, then the Submit button immediately below that (the button should sit close to the form, not pushed down by extra spacing), and finally — below the button — the "this is general/educational information, not legal advice" disclaimer, in smaller text, as the very last thing on the page.

9. **Thank-you screen:** Confirms an employment attorney will call within one business day, suggests keeping documents/records safe in the meantime. Option to start a new case check (resets all state).

10. **Stop screens** (already-represented / statute of limitations / FEHA gate with no remaining categories): Each shows a short, specific explanation for why the flow ended, and a "Start over" option. No lead is captured on any hard-stop path — do not send an email or capture contact info for these.

---

## Visual design system (already fully built in the prototype — replicate exactly)

- **Fonts:** Fraunces (serif, used for headlines, italic weight 500 for emphasis) paired with Inter (sans-serif, used for body/UI text). Loaded via Google Fonts.
- **Colors:** Warm vellum/parchment background (`#EFE8D8`), near-black warm charcoal ink for text (`#211D17`), oxblood/maroon as the primary accent (`#6E2332`, used for CTAs and selected states), brushed gold as a secondary accent (`#92793C`, used for progress indicators and the "§" mark).
- **Progress indicator:** Thin hairline "document rule" ticks across the top of each question screen (not a filled percentage bar) — a ledger/legal-document visual metaphor, styled in gold for completed steps.
- **Layout:** Mobile-first, max-width ~480px, centered on desktop with a subtle shadow/frame so it reads as a phone-width experience being viewed rather than a stretched desktop layout.
- **Interaction pattern:** Every question is answered via full-width tappable option cards (not dropdowns, radio buttons, or sliders), consistent throughout the whole flow.
- **Brand mark:** Currently a placeholder "§ Case Calculator" text mark in the header of every screen — a real logo may be provided later to replace this; build the header in a way that swapping in an image logo later is simple.

All exact CSS values, animations, and markup are in the attached prototype file — use it directly as the reference implementation rather than re-deriving the design from this description.

---

## Backend requirements — ALREADY BUILT, just deploy it

The full backend is already written and included in the `case-calculator-site` folder alongside this document:

- `index.html` — the complete front-end, including a working Submit handler that already POSTs the full lead payload to `/api/submit-lead`
- `api/submit-lead.js` — a complete Vercel serverless function that formats a full, readable email (contact info, tier estimate, free-text notes, and every question/answer organized by section) and sends it via the Resend API
- `.env.example` — lists the two environment variables that need to be set in Vercel (`RESEND_API_KEY`, `LEAD_EMAIL_TO`), plus an optional third (`RESEND_FROM`)
- `README.md` — a step-by-step, non-developer-friendly walkthrough of getting the Resend API key, deploying to Vercel, setting the environment variables, connecting the domain, and testing it end to end

**Your job with this piece is deployment, not development:** take this folder as-is, help the site owner get their Resend API key into Vercel's environment variables, deploy it, and connect their domain. Don't rewrite `api/submit-lead.js` unless something is actually broken — it's tested and complete. If you do change it, preserve the behavior described in the README exactly (full details in the email body, not a summary; graceful fallback so a failed email never blocks the visitor from reaching the thank-you screen; server-side error logging via `console.error` so failures are debuggable in Vercel's Logs tab).

---

## Placeholder values that still need real inputs (flagged clearly, safe to launch with placeholders and update later)

- **Point values and tier dollar thresholds:** Currently rough, non-final estimates set for prototyping purposes only, clearly commented in the code. These are a business/legal judgment call for the site owner and their firm to finalize — don't change them, but don't treat them as correct either. Keep them easy to find and adjust as simple config values.
- **Brand name:** Currently "Case Calculator" as a placeholder throughout. Keep it easy to find-and-replace sitewide once a real name is chosen.
- **Privacy policy and terms of service pages:** Currently just linked placeholders in the consent text. These need real CCPA-compliant page content before a real launch — build the linked pages/routes so they're easy to drop real content into, but placeholder content is fine for now.
- **Logo:** Currently a text "§" mark. Build the header so an image file can replace it easily later.

---

## What NOT to do

- Do not add a database, login system, or dashboard — explicitly out of scope for this version.
- Do not change the question wording, order, or scoring logic without flagging the change first — this was all deliberately decided.
- Do not add urgency/pressure marketing language, outcome guarantees, or anything that reads as a specific legal opinion — this is meant to stay in "general, educational" territory throughout.
- Do not commit any API keys to source control — use Vercel environment variables for everything sensitive.

---

## Deployment checklist

1. Take the `case-calculator-site` folder as-is — front-end and backend are both already written.
2. Follow the folder's own `README.md` for the exact steps: get the Resend API key, deploy to Vercel, add the two required environment variables, connect the custom domain, and test end-to-end.
3. Confirm a real test submission produces a correctly formatted email in the inbox set as `LEAD_EMAIL_TO`.
4. Confirm mobile responsiveness (this is designed mobile-first — most traffic will come from Instagram ad clicks on phones).
5. Only modify `index.html` or `api/submit-lead.js` if something is actually broken or the site owner asks for a specific change — both are complete, working code, not drafts.
