# Marketing website — AddMin

This is the public website — the pages a visitor sees *before* they sign up. Its only job is to get an Office Admin or a Head of Facilities to click "Start Free Trial." It is separate from the product itself (the dashboards, wizards, and approval queues live behind login, covered in `06-frontend.md`) — think of it as the storefront in front of the workshop.

Built with **Astro**, a website builder chosen because this site is almost entirely words and pictures, not an interactive app — it loads fast, ranks well on Google, and doesn't need the heavier machinery the product itself runs on.

## What this website needs to do

1. In one glance, tell a busy Admin/Facilities head "this stops your utility bills, leases, and licences from being missed."
2. Get them to click "Start Free Trial" without needing to talk to a salesperson first.
3. Give a Finance Lead and a CXO — who might also look at this page before approving the purchase — enough to trust it's a serious, secure product, not a side project.
4. Answer the pricing question honestly, without hiding it behind a "Contact us."

## Pages on this website

| Page | What it's for |
|---|---|
| **Home** | The pitch, in 30 seconds. Explains the problem, shows the product briefly, ends with "Start Free Trial." |
| **How it works** | Walks through the day-to-day experience — how an Admin sets up an office, how a missed bill gets caught before it's late. |
| **Pricing** | The three plans, what's included, and a calculator for "how much for my number of offices." |
| **Who it's for** | Three short sections — Admin/Facilities, Finance, and CXO — so each type of visitor can find themselves and their own reason to care. |
| **About / Trust** | Who's behind AddMin, and why a company should trust it with their compliance and payment data. |
| **Blog** | Articles on the problems AddMin solves — utility bill tracking, lease renewals, vendor AMC management — written to be found on Google by someone searching for a fix, not by someone who already knows AddMin exists. |
| **Contact / Book a Demo** | For the Enterprise-size company or design-partner pilot that wants a real conversation before signing up. Secondary to "Start Free Trial," never the main door in. |

## Home page, section by section

Written the way it should read to a visitor — not a list of technical components.

1. **Opening line and headline.** One sentence that names the problem in the visitor's own words — bills, leases, and licences getting missed because nobody has one place tracking them — followed by what AddMin is: the system that tells your admin team what needs attention, instead of waiting for them to remember. A single button: "Start Free Trial." A smaller link next to it: "Book a Demo."
2. **The problem, shown plainly.** A short before/after: "Today — spreadsheets, WhatsApp reminders, and a bill that shows up late. With AddMin — every obligation tracked automatically, flagged before it's due." No jargon, no screenshots of code.
3. **What it actually does.** Five short blocks, each with one line: the Onboarding Checklist ("Tells you what needs to be set up — utilities, leases, licences, vendors"), the Obligation Engine ("Knows a bill is coming before it arrives"), Approvals ("Nothing gets paid without the right sign-off"), the Office dashboard ("See what's due, overdue, or expiring — for one office or all of them"), the Executive view ("One dashboard for the whole company's spend and risk").
4. **Who trusts this.** Space reserved for logos or a short quote once the first design-partner customers are live — held back honestly (no fake logos) until real ones exist.
5. **Pricing preview.** A simplified version of the three plans with a "See full pricing" link, so a visitor doesn't have to leave the home page to get a sense of cost.
6. **FAQ.** Plain-English answers to the questions a first-time visitor actually has: "Is my data safe?", "Can I try it before paying?", "What if I only have 2 offices?", "How is this different from a spreadsheet?"
7. **Final call to action.** Repeats "Start Free Trial" at the bottom, for the visitor who scrolled the whole page before deciding.

## Pricing page, explained simply

Three plans, matching the ranges already set in `01-idea.md` and `03-analysis.md`:

- **Starter** — for a company with a handful of offices, getting the basics of utility and lease tracking under control.
- **Growth** — for a company with up to 10 offices that also needs the approval workflow and compliance tracking running properly.
- **Enterprise** — for anything above 10 offices, priced by conversation rather than a fixed number, because the needs (and the negotiation) get more specific at that size.

Every plan card ends in "Start Free Trial," not "Contact Sales" — the Enterprise card is the only one where "Talk to us" is the main button, since that's genuinely a sales conversation. A short FAQ directly under the pricing table answers "What happens after my trial ends?" and "Can I change plans later?" in plain language, since this is usually where a hesitant buyer stalls out.

## Voice and tone

Written for an Office Admin or Facilities Head, not a developer — no technical words like "API," "database," or "backend" appear anywhere on this site. Sentences are short. Every claim is something the product actually does today, not something planned for later — if a feature is still on the roadmap (e.g. the mobile app), it doesn't appear on the marketing site until it ships.

## How it connects to the product

- The "Start Free Trial" button (homepage, header, and every pricing card except Enterprise) links to the product's `/signup?plan=<plan-name>` page — the first screen of the actual application, covered in `06-frontend.md`.
- "Book a Demo" / "Contact Sales" links to the Contact page's form, which is a sales-assisted path for Enterprise deals and design-partner pilots — it does not create an account by itself.
- Nothing on the marketing site requires a login, and nothing behind login is described here — this file is purely the public-facing storefront.

## Where this lives and how it ships

The marketing site is its own project, `addmin-marketing/`, separate from the AddMin application (`04-architecture.md`'s Wasp app) — it has its own repository folder, its own build, and its own deploy, because a static, words-and-pictures website has nothing in common technically with a logged-in product. It deploys to Fly.io as a small static site, the same platform the product itself deploys to, so the team only has to operate one hosting account.
