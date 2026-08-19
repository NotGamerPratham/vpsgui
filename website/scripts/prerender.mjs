/**
 * Static pre-rendering.
 *
 * A client-rendered SPA serves every crawler the same empty <div id="root">.
 * Google will execute JS eventually, but on a second pass and unreliably, and
 * most other crawlers — Bing, social unfurlers, the AI ones — do not execute it
 * at all. This step renders each route to real HTML at build time and writes
 * the per-route <title>, description, canonical and JSON-LD into the file.
 *
 * Runs after `vite build` and `vite build --ssr`. See package.json.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const ssrDist = resolve(root, 'dist-ssr');

const templatePath = resolve(dist, 'index.html');
if (!existsSync(templatePath)) {
  throw new Error('dist/index.html is missing — run `vite build` before prerendering.');
}

const template = readFileSync(templatePath, 'utf8');

const serverEntry = resolve(ssrDist, 'entry-server.js');
if (!existsSync(serverEntry)) {
  throw new Error('dist-ssr/entry-server.js is missing — run the SSR build before prerendering.');
}

const { render, routeSeo, jsonLdDocument } = await import(pathToFileURL(serverEntry).href);

/** Escape for use inside an HTML attribute value. */
function attr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Escape for use inside element text. */
function text(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * JSON-LD sits inside a <script> block, so the one sequence that must never
 * appear raw is `</script`. Escaping the slash keeps the JSON valid while
 * making the string impossible to read as a closing tag.
 */
function jsonLdSafe(value) {
  return JSON.stringify(value).replaceAll('</', '<\\/');
}

/**
 * Rewrite the <meta> tag carrying `key`, whatever whitespace the formatter put
 * inside it. An earlier version matched `<meta name="x" content="y">` on a
 * single line and silently skipped every tag Prettier had wrapped across three,
 * so each route shipped the homepage's description. Matching the whole tag and
 * then testing its contents is formatting-proof.
 */
function replaceMeta(html, attrName, key, content) {
  let replaced = false;

  const out = html.replace(/<meta\b[^>]*>/g, (tag) => {
    if (replaced) return tag;
    // Attribute may be quoted with either quote style and split over lines.
    const carries = new RegExp(`${attrName}\\s*=\\s*["']${key}["']`).test(tag);
    if (!carries) return tag;
    replaced = true;
    return `<meta ${attrName}="${key}" content="${attr(content)}" />`;
  });

  if (!replaced) {
    throw new Error(
      `prerender: no <meta ${attrName}="${key}"> in dist/index.html. ` +
        'Add it to index.html or drop it from the prerender list — silently ' +
        'skipping it would ship the wrong tag on every route.',
    );
  }

  return out;
}

function replaceCanonical(html, href) {
  let replaced = false;

  const out = html.replace(/<link\b[^>]*>/g, (tag) => {
    if (replaced || !/rel\s*=\s*["']canonical["']/.test(tag)) return tag;
    replaced = true;
    return `<link rel="canonical" href="${attr(href)}" />`;
  });

  if (!replaced) throw new Error('prerender: no <link rel="canonical"> in dist/index.html.');
  return out;
}

function buildHead(html, seo) {
  let out = html;

  if (!/<title>[\s\S]*?<\/title>/.test(out)) {
    throw new Error('prerender: no <title> in dist/index.html.');
  }
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${text(seo.title)}</title>`);

  out = replaceMeta(out, 'name', 'description', seo.description);
  out = replaceMeta(out, 'property', 'og:title', seo.title);
  out = replaceMeta(out, 'property', 'og:description', seo.description);
  out = replaceMeta(out, 'property', 'og:url', seo.canonical);
  out = replaceMeta(out, 'name', 'twitter:title', seo.title);
  out = replaceMeta(out, 'name', 'twitter:description', seo.description);
  out = replaceCanonical(out, seo.canonical);

  if (seo.jsonLd?.length) {
    const ld = `<script type="application/ld+json" id="route-jsonld">${jsonLdSafe(
      jsonLdDocument(seo.jsonLd),
    )}</script>`;
    out = out.replace('</head>', `  ${ld}\n  </head>`);
  }

  return out;
}

const written = [];

for (const seo of routeSeo) {
  const appHtml = render(seo.path);

  if (!appHtml || appHtml.length < 500) {
    throw new Error(
      `prerender: ${seo.path} rendered ${appHtml.length} bytes, which means the route ` +
        'produced no real markup. Check that it is registered in AppShell.',
    );
  }

  let html = buildHead(template, seo);

  if (!html.includes('<div id="root"></div>')) {
    throw new Error('prerender: could not find the empty root div to fill in dist/index.html.');
  }
  html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

  // Two filename forms per route, because static hosts disagree about how an
  // extension-less URL resolves. `dist/docs.html` covers hosts that append
  // `.html`; `dist/docs/index.html` covers hosts that look for a directory
  // index. Emitting only the directory form meant `/docs` fell through to the
  // SPA fallback and served the *home page* — same URL, wrong content, wrong
  // canonical, which is worse for search than not prerendering at all.
  const outPaths =
    seo.path === '/'
      ? [resolve(dist, 'index.html')]
      : [resolve(dist, `.${seo.path}.html`), resolve(dist, `.${seo.path}`, 'index.html')];

  for (const outPath of outPaths) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');
  }

  written.push({ path: seo.path, bytes: Buffer.byteLength(html), files: outPaths.length });
}

/* --- sitemap.xml ---------------------------------------------------------- */

const today = new Date().toISOString().slice(0, 10);

const urls = routeSeo
  .map(
    (seo) => `  <url>
    <loc>${attr(seo.canonical)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${seo.changefreq}</changefreq>
    <priority>${seo.priority}</priority>
  </url>`,
  )
  .join('\n');

writeFileSync(
  resolve(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
  'utf8',
);

/* --- cleanup -------------------------------------------------------------- */

// The SSR bundle is a build artifact; shipping it would put the whole app in
// the deploy directory a second time.
rmSync(ssrDist, { recursive: true, force: true });

console.log('prerendered:');
for (const entry of written) {
  console.log(
    `  ${entry.path.padEnd(12)} ${String(entry.bytes).padStart(7)} bytes  x${entry.files}`,
  );
}
console.log(`  sitemap.xml  ${routeSeo.length} urls`);
