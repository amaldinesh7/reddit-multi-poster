# Upgrade UX/UI Plan — Simple & Minimal

## Principles

- **No banner on landing** — First paint is the product (create post), not paywall.
- **Point-of-need** — Show upgrade only where it’s relevant (picking subreddits, settings, header).
- **Minimal copy** — Short, benefit-led; one primary CTA path.
- **Paid = same picker UX** — Allow search/temporary for paid; only cap at 5. No hidden blocks.

---

## Where upgrade appears

| Location | What | When |
|----------|------|------|
| **Header** | Single “Upgrade” text link (or “₹199”) next to user menu | Always, for free users only. No dropdown; one click → checkout. |
| **Subreddit section (home)** | One line under “Subreddits” / next to “Manage”: “Upgrade to use up to 5 — ₹199” (link). | Free users only. Inline, not a box. |
| **Settings** | When at 5 subreddits or in “Add subreddit” area: short line “Max 5 on your plan” or “Upgrade for more” link. | Paid users see limit; free see upgrade. |
| **Removed** | Top-of-page upgrade banner. | Delete. |

---

## Copy (minimal)

- **Header link:** “Upgrade” or “₹199”
- **Subreddit section:** “Upgrade to use up to 5 — ₹199” (link)
- **Settings at limit:** “You’ve reached the 5 subreddit limit.” (no CTA needed for paid)
- **Settings (free):** “Upgrade to add up to 5 subreddits — ₹199” (link when adding)

---

## Behaviour change: paid + search/temporary

- **Current:** Paid users don’t see search/temporary block.
- **New:** Paid users see the same picker as free (including search); only **max 5** selected and **max 5** in settings. No hiding.

---

## Implementation (senior frontend)

- **Single checkout handler** — One shared function (e.g. `handleUpgrade`) used by header, subreddit section, settings. No duplicated logic.
- **Accessibility** — Upgrade links: focus ring, `aria-label` (“Upgrade to full access”), no buttons without labels.
- **No layout shift** — Upgrade link in header is same height as rest of header; subreddit line doesn’t change layout for paid vs free (e.g. reserve space or same line count).
- **Loading state** — On “Upgrade” click: disable link/button, optional “Opening…” or spinner so user knows something is happening before redirect.
- **Reuse existing** — Use existing `Button`/link styles and `auth.entitlement` / `auth.limits`; no new design system tokens.

---

## Files to touch

1. **pages/index.tsx** — Remove top upgrade banner. Add one line (link) in subreddit section for free users.
2. **components/layout/AppHeader.tsx** — Accept `entitlement` + optional `onUpgrade`. Render “Upgrade” link when free.
3. **pages/index.tsx** (AppHeader usage) — Pass `entitlement` and `onUpgrade` (checkout redirect).
4. **components/SubredditFlairPicker.tsx** — Remove `temporarySelectionEnabled` hiding search for paid; keep only `maxSelection` (5 for paid).
5. **lib/entitlement.ts** (or UI constants) — Set `temporarySelectionEnabled: true` for paid so picker shows search.
6. **pages/settings.tsx** — Add short “Upgrade to add up to 5” when free; “5/5 subreddits” when paid (already have count).

---

## Out of scope (keep as-is)

- Queue/post flow messaging (no new copy there unless we add a free-tier post limit later).
- Checkout success page.
- Webhook / API behaviour.
