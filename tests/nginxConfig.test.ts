import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guards on the shipped nginx site config.
 *
 * These are not style checks. nginx's `add_header` inheritance rule is a genuine footgun: a
 * location block that declares ANY add_header of its own discards every add_header from the
 * enclosing server block rather than merging with it. The config had three such blocks -
 * /assets/, the service worker, and the /api/v1/ proxy - each setting only Cache-Control, and
 * each therefore serving responses with no CSP and no nosniff at all.
 *
 * Nothing about that is visible when reading the file top to bottom, and nginx does not warn,
 * so it is asserted here instead.
 */

const CONFIG = readFileSync(resolve(__dirname, '../deploy/nginx.conf'), 'utf-8');
const AGENT = readFileSync(resolve(__dirname, '../agent/server.js'), 'utf-8');

/** Every header the server block sets and every location must therefore repeat. */
const REQUIRED_HEADERS = [
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Content-Security-Policy',
];

/** Strip comments so a `}` or an `add_header` mentioned in prose is not parsed as config. */
function stripComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

/** Pull out `location ... { ... }` bodies. The config nests no braces inside a location. */
function locationBlocks(text: string): { header: string; body: string }[] {
  const blocks: { header: string; body: string }[] = [];
  const re = /location\s+([^{]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    blocks.push({ header: match[1].trim(), body: match[2] });
  }
  return blocks;
}

describe('deploy/nginx.conf security headers', () => {
  const clean = stripComments(CONFIG);

  it('sets every security header at the server level', () => {
    for (const header of REQUIRED_HEADERS) {
      expect(clean).toContain(`add_header ${header}`);
    }
  });

  it('finds the location blocks it means to check', () => {
    // If the parse silently matched nothing, every assertion below would vacuously pass.
    const blocks = locationBlocks(clean);
    expect(blocks.length).toBeGreaterThanOrEqual(4);
  });

  it('repeats every security header in each location that sets add_header', () => {
    for (const { header, body } of locationBlocks(clean)) {
      if (!body.includes('add_header')) continue; // inherits the server block cleanly

      for (const required of REQUIRED_HEADERS) {
        expect(
          body,
          `location ${header} declares add_header, so it drops all inherited headers - ` +
            `it must repeat ${required}`
        ).toContain(`add_header ${required}`);
      }
    }
  });

  it('marks the headers `always` so they survive error responses', () => {
    // Without `always`, nginx omits add_header on 4xx/5xx - exactly the responses an attacker
    // is most likely to be probing.
    // The value must be matched as a quoted string, not up to the first semicolon: a CSP is full
    // of internal semicolons, so a naive `[^;]*;` truncates mid-directive and never sees `always`.
    const re =
      /add_header\s+(X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy|Content-Security-Policy)\s+"[^"]*"([^;]*);/g;

    const seen: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(clean)) !== null) {
      seen.push(match[1]);
      expect(match[2].trim(), `add_header ${match[1]} is missing 'always'`).toBe('always');
    }

    // Guard the guard: a regex that matched nothing would pass the loop silently.
    for (const header of REQUIRED_HEADERS) {
      expect(seen, `no add_header ${header} was parsed`).toContain(header);
    }
  });
});

describe('deploy/nginx.conf body limits', () => {
  it('allows a body at least as large as the agent will accept', () => {
    // nginx rejects an oversized body before the agent ever sees it. If this cap is the smaller
    // of the two, the upload endpoints fail with a bare HTML 413 and the agent's own limit -
    // and its readable JSON error - is unreachable.
    const nginxCap = /client_max_body_size\s+(\d+)m\s*;/.exec(stripComments(CONFIG));
    expect(nginxCap, 'client_max_body_size is not declared in megabytes').not.toBeNull();

    const agentCap = /AGENT_MAX_UPLOAD_MB[\s\S]*?\|\|\s*(\d+)\s*\)\s*\*/.exec(AGENT);
    expect(agentCap, 'could not read the agent upload cap from server.js').not.toBeNull();

    expect(Number(nginxCap![1])).toBeGreaterThan(Number(agentCap![1]));
  });
});
