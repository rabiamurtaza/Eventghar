# Project rules

- **NEVER ADD HARDCODED BUTTONS.** Every button and link must do something real. It must point to a real route or action, and contact values (WhatsApp, email, Instagram) and nav links must come from `src/config/site.ts`, not be typed inline in components. No placeholder `href="#"`.

# Changes on branch `hero-change-by-wali` (not pushed)

Nothing here has been pushed. Push only after explicit approval.

## Hero (src/components/HeroSlider.tsx)

- Layout modeled on rivieraresortnaran.pk: left-aligned content, gradient overlay (dark at the bottom on mobile, dark on the left on desktop), kicker pill, serif headline, subtitle, two buttons (Browse events, Host an event), staggered fade-up.
- Hero is 5% taller than the first redesign (588 / 630 / 714px).
- Square bottom corners (rounded corners removed on request).
- Spinner and "Loading Highlights..." replaced with a pulsing skeleton behind the text.
- Swipe and drag still work (`touch-pan-y`). The arrow buttons were added and then removed.
- Hero section has `id="home-hero"` so the navbar can measure it.

## Top bar (src/components/Navbar.tsx)

- Liquid glass applied to the bar, always on (`src/components/uilayouts/liquid-glass.tsx`, from uilayouts). New deps: `motion`, `clsx`, `tailwind-merge`; new helper `src/lib/utils.ts`.
- Bar narrowed to `max-w-4xl`.
- Logo is back to the original: plain "Event" + purple "Ghar" text in Bricolage Grotesque (loaded via `next/font`, used only by the logo through `.font-logo`). The serif wordmark experiment was reverted.
- Middle of the bar has nav links (Events, How it works, Contact) from `siteConfig.navLinks`; "Explore" shows on phones only.
- Fixed: glass turned light after 80px of scroll while still over the dark hero. It now switches only when the hero's bottom edge passes under the bar.
- Tested in Edge (desktop, mobile, scrolled): every top-bar button is reachable and works.

## Fonts (src/app/layout.tsx, src/app/globals.css)

- Self-hosted via `next/font`: **Inter** for body and UI, **Fraunces** for headings, display text and the logo. The Google `@import` was removed.
- `font-heading`, `font-serif-display` and h1 to h6 use Fraunces; `font-body` and body use Inter.
- Removed the extra letter and word spacing; body line-height 1.6.

## Main page (src/app/page.tsx, src/components/EventsSection.tsx, src/components/SectionHeader.tsx)

- Shared `SectionHeader` for "How booking works" and "Explore Upcoming Events" (no label pills).
- How booking works: simplified to three cards with a big number, a short title and one plain sentence.
- Search box matches event title, description and venue (placeholder "Search events or venues..."). There is no separate venue field.
- Event cards show the venue next to the city; the price is larger.
- Rounded cards (`rounded-3xl`) on the steps, filter panel and event cards.
- "Running an event?" is a rounded purple card with Request an event, plus WhatsApp and email buttons.
- Contact values and nav links come from `src/config/site.ts` (new). Email fallback is `eventghar1@gmail.com` (override with `NEXT_PUBLIC_SUPPORT_EMAIL`); WhatsApp `923325727917`.

## Footer (src/components/Footer.tsx)

- LinkedIn removed. The WhatsApp and Instagram icon row under "Connect With Us" was removed too (the text Instagram link, email and copyright stay).
- Instagram links to https://instagram.com/eventgharofficial with the handle shown.
- Copyright moved into the contact column; the bottom bar is gone and the footer is shorter.
- Contact values read from `siteConfig`.

## Site-wide styling pass

- Across 23 `.tsx` files: `rounded-2xl`/`rounded-3xl` changed to `rounded-lg`, `backdrop-blur-*` removed, `shadow-xl`/`shadow-2xl` toned down. The main page cards were then rounded back up to `rounded-3xl`.

## Support email

- `eventghar1@gmail.com` is the confirmed support email. The home card, footer, contact page and terms page all read it from `src/config/site.ts`.

## Open items

- **Claude Code icons breaking in Windows cmd/PowerShell:** not fixed. PowerShell is on UTF-8; Windows Terminal is installed but unconfigured. Glyphs used: `✓ ❯ ⚠ ✗ ◼ ✔ ● ⎯ ⧉ ✘ ⏵`.
- **UI/UX skill (`nextlevelbuilder/ui-ux-pro-max-skill`):** not installed. Run `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`.
