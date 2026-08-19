import { StaticRouter } from 'react-router-dom/server';
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
