# VPSGUI — marketing site

The public site for [VPSGUI](https://github.com/NotGamerPratham/vpsgui). It is a
**separate application** from the console in `../src`: static, dependency-free at
runtime, and it never talks to an agent or holds a token.

## Why it is separate

The console is an operator tool that lives behind your firewall. The marketing
site is meant to be on a CDN. Keeping them apart means the public bundle carries
no API client, no auth code and no agent URL, and the console carries no
marketing weight.

That separation is also why this directory has its own `package.json` and its own
Tailwind version — see below.

## Stack

| | |
| :--- | :--- |
| Build | Vite 5 |
| UI | React 18 + TypeScript |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` |
| Components | shadcn/ui (`new-york`), Radix primitives |
| Motion | framer-motion |
| Icons | lucide-react |
| Routing | react-router-dom v6 |
| Type | Geist, Geist Mono, Instrument Serif |
| Rendering | Static prerender of every route at build time |

### Two Tailwind versions in one repo

The console runs Tailwind **v3** with a `tailwind.config.js` and a
`postcss.config.js` at the repository root. This site runs Tailwind **v4**, which
is configured in CSS (`src/index.css`) with no JS config at all.

Vite walks up the directory tree looking for a PostCSS config, so it would find
the root one and run the v3 plugin over v4 source — which fails on `@layer base`.
`vite.config.js` sets `css.postcss: { plugins: [] }` to stop that search. Do not
remove it.

## Commands

Run from this directory, or with `--prefix website` from the repository root.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run build` does three things in order: typecheck, build the client bundle,
build an SSR bundle, then run `scripts/prerender.mjs` to render every route to
static HTML and emit `sitemap.xml`. `npm run build:client` skips the prerender
if you just want the bundle. `npm run preview` serves the finished `dist/`.

The dev server listens on `3007` by default and honours `PORT` if set.

## Deploying

`npm run build` emits a fully static `dist/`. Each route is written **twice**,
because static hosts disagree about how an extension-less URL resolves:

```
dist/index.html
dist/docs.html      dist/docs/index.html
dist/api.html       dist/api/index.html
dist/security.html  dist/security/index.html
dist/sitemap.xml    dist/robots.txt
```

Hosts that append `.html` find the first form; hosts that look for a directory
index find the second. Both carry the same canonical, so the duplication costs
nothing in search terms.

This matters more than it sounds. With only the directory form, a request for
`/docs` fell through to the SPA fallback and was served **`index.html` — the
home page** — under the `/docs` URL, with the home page's canonical and title.
That is strictly worse for search than not prerendering at all, and it is
invisible unless you request the extension-less path specifically.

For nginx, put the file lookups ahead of the SPA fallback:

```nginx
location / { try_files $uri $uri.html $uri/index.html /index.html; }
```

The final `/index.html` is only for genuine 404s, which React Router renders as
the not-found page (marked `noindex`). Netlify, Vercel and Cloudflare Pages
resolve both forms without configuration.

Update `SITE_URL` in `src/data/seo.ts` before deploying anywhere other than
`vpsgui.dev` — it is the source for every canonical URL and every sitemap entry.

## Editing content

Copy lives in `src/data/`, not in components:

| File | Holds |
| :--- | :--- |
| `site.ts` | Links, install commands, headline stats, footer |
| `features.ts` | The nine feature cards |
| `api.ts` | Every agent endpoint shown on `/api` |
| `security.ts` | The guarantees / operator-duties split |
| `faq.ts` | FAQ entries |
| `quickstart.ts` | The four install steps |
| `sdk.ts` | Node, Python and curl samples |
| `docs.ts` | Every section of `/docs`, as structured blocks |
| `limits.ts` | The "what it is not" section |
| `seo.ts` | Per-route title, description, canonical and JSON-LD |

**Keep the numbers true.** `stats` in `site.ts` claims 46 REST endpoints; that is
counted from the route table in `agent/server.js`. If routes are added or
removed, update `api.ts` and that figure together:

```bash
grep -oE "pathname === '/api/v1[^']*'" ../agent/server.js | sort -u | wc -l
```

The same rule the console follows applies to this page: no invented figures, no
borrowed logos, no star counts that are not real. The terminal animation in the
hero is labelled as an example session against a fictional host, and it shows
`smartHealth: null` on purpose, because that is what the agent really returns
when `smartctl` is absent.

## Design rules — claymorphism

Surfaces are moulded clay: soft, warm, and lit from the top-left.

- **Three shadows, always.** A clay surface carries a wide drop *and* an inset
  highlight *and* an inset shade. Drop any one and it goes flat. Use the
  `clay` / `clay-sm` / `clay-lg` / `clay-inset` utilities rather than hand-rolling
  a `box-shadow`.
- **Raised or pressed, and it means something.** `clay` sits on the page,
  `clay-inset` is pressed into it. Inputs, tab tracks and the operator-duty cards
  are inset because they are not finished; cards and panels are raised.
- **Clay utilities never set a radius.** They set colour and shadow only, and the
  markup always names its own `rounded-*`. An earlier version set both, which
  left the winner up to emit order and silently turned 32px chips into circles.
- **Black and white only — outside the code surfaces.** Every page token sits at
  chroma `0`: greys, pure white, pure black, nothing else. This is enforceable —
  sample every computed `color`, `background-color`, `border-color`, `fill`,
  `stroke` and `box-shadow`, skip anything inside `[class*="bg-terminal"], pre,
  code`, and assert `R == G == B` on the rest.
- **The terminal is the one exception, and it is a deliberate one.** A terminal
  is a depiction of another program's output, and that output is genuinely
  coloured; rendering it in greys would be showing something the real shell does
  not do. The `--syn-*` tokens in `index.css` are the only chromatic values on
  the site, they are identical in both themes (the terminal is dark either way),
  and every one clears 4.5:1 against the terminal background.
- **Severity without hue.** Removing colour removed a signalling channel, so it
  moved to three others: an explicit word (`Note` / `Important` / `Warning`,
  `built in` / `your job`), border weight (2px → 4px), and an inverted fill
  (`bg-foreground text-background`) for the most severe. Nothing on this site
  depends on colour alone to be understood, which is WCAG 1.4.1.
- **Syntax highlighting is real tokenising, not brightness tiers.**
  `src/lib/highlight.tsx` has four tokenisers — shell, JSON, tabular output, and
  TypeScript/Python — because running one over all of them produced nonsense
  colours. Two details are what make it read correctly, and both are easy to
  regress:
  - In shell, the *first bare word of each line or pipeline segment* is the
    command. The state has to reset on newlines, or only the first command in a
    multi-line snippet is coloured. Flags are matched by shape (`-x`, `--long`),
    not by the whitespace in front of them, or an indented continuation flag is
    missed.
  - In JSON, a string is a **key** only when the next non-space character is a
    colon. That single check is all that separates `"status"` from `"ok"`.
- **Type does not shout.** Headings stay weight `500` at `-0.022em` — clay
  already supplies the visual weight. Emphasis is one word in Instrument Serif
  italic (`.accent-word`), never a gradient.
- **Watch for tokens that collapse.** In monochrome `--primary` *is* the
  foreground, so `hover:text-primary` became a no-op and had to become
  `hover:opacity-65`; `--destructive` is near-white in dark mode, so a hardcoded
  `text-white` label on it would be invisible. Any rule that assumed two tokens
  differed in hue needs re-checking.
- **Left-aligned.** Section headings carry a two-digit mono index in a pressed
  chip. Centred headings stacked down a page is the template look.

Utilities are declared with `@utility`, not inside `@layer utilities`, so they
compose with variants — `data-[state=active]:clay` on the active tab silently
generates nothing under the `@layer` form.

Not everything imported from shadcn stayed: `badge`, `separator` and `card` were
removed once nothing used them. Re-add with `npx shadcn@latest add <name>`.

## SEO

The site is client-rendered, which normally means every crawler receives an
empty `<div id="root">`. Google executes JS on a second pass; Bing, social
unfurlers and most AI crawlers do not. So the build prerenders instead.

- `scripts/prerender.mjs` renders each route with `renderToString` and writes a
  real HTML file per route, then bakes in that route's title, description,
  canonical, Open Graph tags and JSON-LD.
- `src/data/seo.ts` is the single source for all of that. `usePageMeta` reads it
  at runtime for client-side navigation; the prerender reads it at build time.
  They cannot disagree.
- JSON-LD: `SoftwareApplication` + `WebSite` + `FAQPage` on the home page,
  `TechArticle` + `BreadcrumbList` on the rest. The FAQ markup mirrors the FAQ
  actually rendered on the page — marking up invisible questions is what earns a
  manual action.
- `sitemap.xml` is generated from the same route list. `robots.txt` points at it.
- The prerender **throws** rather than skipping when a tag it expects is missing.
  It previously matched single-line `<meta>` tags only, silently skipped the ones
  the formatter had wrapped, and shipped the homepage description on every route.

Pages are imported eagerly in `App.tsx` rather than through `React.lazy`:
`renderToString` cannot resolve a lazy boundary and would write the Suspense
fallback into the file a crawler reads.

### Hydration

Prerendered HTML must match what React renders on its first client pass, or
React throws the whole tree away and re-renders — losing the benefit and
spamming the console. Two things broke this and are worth not reintroducing:

- **Animations that start in a mount effect.** `TerminalDemo` called its first
  `setState` synchronously inside `useEffect`, which lands during the hydration
  commit. It now starts on a timeout.
- **Anything rendered from a stored preference.** `ThemeToggle` rendered its
  icon and label from theme state, so the server said "Switch to light theme"
  and a light-mode visitor's client said the opposite. The icon is now chosen by
  a `dark:` CSS variant, which needs no state and cannot disagree.

To debug a mismatch, build with React's development bundle — the production one
only prints minified error codes:

```bash
npx vite build -c vite.diag.config.js
```

Then rebuild the SSR bundle, re-run `scripts/prerender.mjs`, and `npm run
preview`. Rebuild with `npm run build` when you are done — the diagnostic bundle
is roughly three times the size and must not be deployed.

None of this guarantees a ranking. Technical SEO makes a page eligible and
legible; position depends on the content being genuinely useful and on other
people linking to it, neither of which a build step can manufacture.

## Accessibility notes

- Every decorative icon carries `aria-hidden`; every icon-only control has an
  `aria-label`.
- Every colour token clears WCAG AA against its background in both themes,
  measured rather than assumed. Two are deliberately off the "obvious" value for
  that reason: light-mode `--primary` is darker than the dark-mode green to clear
  4.5:1 on white, and `--subtle` is lighter than it looks like it should be
  because it carries the 12px mono eyebrow labels.
- All motion is gated behind `prefers-reduced-motion`, and the hero terminal
  renders its full transcript instead of typing when motion is reduced.
- The mobile menu is conditionally rendered rather than animated out, so its
  links never linger in the focus order while invisible.
