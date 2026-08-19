import { useEffect } from 'react';

import { SITE_URL, jsonLdDocument, seoFor } from '@/data/seo';

function upsertMeta(key: string, attr: 'name' | 'property', content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Keeps head tags in step with the active route on client navigation.
 *
 * The prerender step already bakes these into each route's static HTML, so a
 * crawler never depends on this running — it exists for people navigating
 * client-side, whose tab title, canonical and share preview would otherwise be
 * stuck on whichever page they landed on first.
 */
export function usePageMeta(path: string) {
  useEffect(() => {
    const seo = seoFor(path);
    if (!seo) return;

    document.title = seo.title;
    upsertMeta('description', 'name', seo.description);
    upsertMeta('og:title', 'property', seo.title);
    upsertMeta('og:description', 'property', seo.description);
    upsertMeta('og:url', 'property', seo.canonical);
    upsertMeta('twitter:title', 'name', seo.title);
    upsertMeta('twitter:description', 'name', seo.description);
    upsertLink('canonical', seo.canonical);

    // Replace rather than append: leaving the previous route's graph behind
    // would describe the visitor as being on two pages at once.
    const existing = document.getElementById('route-jsonld');
    if (existing) existing.remove();

    if (seo.jsonLd?.length) {
      const script = document.createElement('script');
      script.id = 'route-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLdDocument(seo.jsonLd));
      document.head.appendChild(script);
    }
  }, [path]);
}

export { SITE_URL };
