# addmin-marketing

The public marketing site for AddMin — Home, How it works, Pricing, Who it's for, About/Trust, Blog, and Contact.
Separate project from `addmin-app/` (the Wasp product): its own dependencies, its own build, its own deploy, since a
static, words-and-pictures site has nothing in common technically with a logged-in product. See
`planmysaas-blueprint/09-marketing-website.md` for the content spec and `08-build-playbook.md`'s Build Step 10 for
the acceptance criteria this was built against.

Built with [Astro](https://astro.build) — static output, no client-side framework, no auth, no dynamic data.

## Commands

| Command | Action |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at `localhost:4321` |
| `npm run build` | Build the static site to `./dist/` |
| `npm run preview` | Serve the built `./dist/` locally |
| `npx astro check` | Type-check `.astro` files |

## Environment variables

Copy `.env.example` to `.env` and set:

- `PUBLIC_APP_URL` — the live AddMin App URL every "Start Free Trial" button deep-links into (`/signup?plan=<plan>`).
- `PUBLIC_CONTACT_FORM_ENDPOINT` — optional form-handling endpoint (e.g. Formspree) for the Contact page. Left
  unset, the contact form shows a direct email fallback instead of silently failing.

## Pricing

`src/content/pricing.ts` is the single source of truth for plan prices and features — every pricing card on the
Home and Pricing pages reads from it. **Before a real launch**, reconcile it against the live Stripe Prices in
`addmin-app` (`src/server/billing/stripeClient.ts`) — that file currently only has a placeholder Starter price wired
up for testing the Checkout integration, not the real ₹15,000/₹25,000 figures this site quotes.

## Deploying

Deploys to Fly.io as its own app (`fly.toml`), independent of `addmin-app`'s deploy:

```sh
fly launch   # first time only, to create the Fly app
fly deploy
```

The `Dockerfile` builds the static site and serves it via nginx (`nginx.conf`) — there's no server-side code to run.

## Blog

Posts live in `src/content/blog/*.md`, schema defined in `src/content.config.ts`. Each post should target a real
search query from a problem cluster in `planmysaas-blueprint/02-research.md` — the first post
(`utility-bill-tracking-for-multiple-offices.md`) targets "utility bill tracking for multiple offices."
