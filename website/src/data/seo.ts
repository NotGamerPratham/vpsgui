import { faqs } from './faq';
import { site } from './site';

/**
 * One record per route, consumed twice: by usePageMeta at runtime, and by
 * scripts/prerender.mjs at build time to bake the same tags into static HTML.
 * Keeping both readers on one source is the only way the rendered page and the
 * crawled page stay in agreement.
 */

export const SITE_URL = 'https://vpsgui.dev';

export interface RouteSeo {
  path: string;
  title: string;
  description: string;
  /** Rendered into <link rel="canonical"> and og:url. */
  canonical: string;
  /** Included in sitemap.xml. Rough guide to how often the page really changes. */
  changefreq: 'weekly' | 'monthly';
  priority: string;
  /** Extra JSON-LD beyond the site-wide graph. */
  jsonLd?: Record<string, unknown>[];
}

const org = {
  '@type': 'Person',
  '@id': `${SITE_URL}/#author`,
  name: site.author.name,
  url: site.author.url,
};

const softwareApplication = {
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#software`,
  name: 'VPSGUI',
  applicationCategory: 'DeveloperApplication',
  applicationSubCategory: 'Server management',
  operatingSystem: 'Linux',
  description: site.description,
  url: SITE_URL,
  downloadUrl: site.repo,
  softwareVersion: site.version,
  license: site.license.url,
  author: org,
  isAccessibleForFree: true,
  // Free and open source. Declared as a real zero-price offer rather than
  // omitted, because "free" is a genuine differentiator for this category.
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  softwareRequirements: 'Node.js 18 or newer, Linux',
};

const website = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'VPSGUI',
  description: site.description,
  publisher: { '@id': `${SITE_URL}/#author` },
  inLanguage: 'en',
};

function breadcrumb(trail: Array<{ name: string; path: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

function techArticle(headline: string, description: string, path: string) {
  return {
    '@type': 'TechArticle',
    headline,
    description,
    url: `${SITE_URL}${path}`,
    author: org,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    inLanguage: 'en',
  };
}

export const routeSeo: RouteSeo[] = [
  {
    path: '/',
    title: 'VPSGUI - run your Linux servers from a browser tab',
    description:
      'Open-source, self-hosted control plane for Linux servers and Docker. Live telemetry from /proc, a host shell, file manager, firewall, secrets and backups. MIT licensed, no account required.',
    canonical: `${SITE_URL}/`,
    changefreq: 'weekly',
    priority: '1.0',
    jsonLd: [
      softwareApplication,
      website,
      {
        '@type': 'FAQPage',
        // Mirrors the FAQ actually rendered on the page. Marking up questions
        // that are not visible is exactly what earns a manual action.
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  },
  {
    path: '/docs',
    title: 'Documentation - install, configure and troubleshoot VPSGUI',
    description:
      'Install VPSGUI, configure the agent, put it behind TLS, add more hosts and troubleshoot it. Full environment-variable reference and built-in limits.',
    canonical: `${SITE_URL}/docs`,
    changefreq: 'weekly',
    priority: '0.9',
    jsonLd: [
      techArticle(
        'VPSGUI documentation',
        'Install, configure, secure and troubleshoot a VPSGUI deployment.',
        '/docs',
      ),
      breadcrumb([
        { name: 'Home', path: '/' },
        { name: 'Documentation', path: '/docs' },
      ]),
    ],
  },
  {
    path: '/api',
    title: 'API reference - all 46 VPSGUI agent endpoints',
    description:
      'Every REST endpoint the VPSGUI agent serves: telemetry, processes, Docker, files, firewall, secrets, network, storage, backups, deployments and terminal.',
    canonical: `${SITE_URL}/api`,
    changefreq: 'monthly',
    priority: '0.8',
    jsonLd: [
      techArticle(
        'VPSGUI agent API reference',
        'All 46 REST endpoints exposed by the VPSGUI agent daemon.',
        '/api',
      ),
      breadcrumb([
        { name: 'Home', path: '/' },
        { name: 'API reference', path: '/api' },
      ]),
    ],
  },
  {
    path: '/security',
    title: 'Security model - what VPSGUI protects and what it does not',
    description:
      'The VPSGUI agent token is root-equivalent. What the agent enforces, what the operator must do, the threat scenarios, and a hardening checklist.',
    canonical: `${SITE_URL}/security`,
    changefreq: 'monthly',
    priority: '0.8',
    jsonLd: [
      techArticle(
        'VPSGUI security model',
        'Guarantees the agent enforces, duties left to the operator, and how to harden a deployment.',
        '/security',
      ),
      breadcrumb([
        { name: 'Home', path: '/' },
        { name: 'Security model', path: '/security' },
      ]),
    ],
  },
];

export function seoFor(path: string): RouteSeo | undefined {
  return routeSeo.find((r) => r.path === path);
}

/** The @graph wrapper shared by every page. */
export function jsonLdDocument(entries: Record<string, unknown>[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': entries,
  };
}
