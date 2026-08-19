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

`npm run typecheck` runs `tsc --noEmit` on its own. `npm run preview` serves the
production build.

The dev server listens on `3007` by default and honours `PORT` if set.

## Deploying

`npm run build` emits a fully static `dist/`. Any static host works. Because
routing is client-side, the host must rewrite unknown paths to `index.html`, or
`/api` and `/security` will 404 on a hard refresh.

Nginx:

```nginx
location / { try_files $uri $uri/ /index.html; }
```

Netlify (`public/_redirects`), Vercel (`rewrites`) and Cloudflare Pages have
equivalent one-liners.

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

## Design rules

The first cut of this site looked generated, because it used every house style
of a generated page at once: gradient headline text, drifting colour blobs, a
pill badge with a pulsing dot, glassmorphism, nine identical cards each with its
own accent colour, a big-numbers strip and a logo marquee. The rules below exist
to keep it from drifting back.

- **No gradient text.** Headline emphasis is one word in Instrument Serif
  italic (`.accent-word`). That is the only emphasis device.
- **Medium weight, tight tracking.** Display type is `500` at `-0.022em`, set in
  the base layer. Nothing on the page is `font-bold` or heavier.
- **Near-monochrome.** Greys are held at roughly `0.004` chroma so they read as
  ink, not as blue. Colour is information, never decoration: green for the
  accent and things that work, amber for what the operator still has to do, red
  for what will hurt them.
- **Hairlines, not cards.** Sections are separated by 1px rules. No glow, no
  backdrop blur, no stacked shadows.
- **Left-aligned.** Section headings carry a two-digit mono index and sit on the
  left margin. Centred headings stacked down a page is the template look.
- **One background treatment.** A single faint grid that fades out. That is all.

Not everything imported from shadcn stayed: `badge`, `separator` and `card` were
removed once nothing used them. Re-add with `npx shadcn@latest add <name>`.

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
