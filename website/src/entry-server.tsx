// v7 removed the `react-router-dom/server` subpath and moved StaticRouter to
// the main entry. v6 exports it from both, so this import works on either.
import { StaticRouter } from 'react-router-dom';
import { renderToString } from 'react-dom/server';

import { AppShell } from './App';

export { routeSeo, jsonLdDocument, SITE_URL } from './data/seo';

/**
 * Build-time entry. scripts/prerender.mjs calls this once per route and writes
 * the result into the client template, so every page ships real HTML instead of
 * an empty root div.
 */
export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <AppShell />
    </StaticRouter>,
  );
}
