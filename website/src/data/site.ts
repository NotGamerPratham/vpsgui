import type { NavLink } from '@/types';

/**
 * Single source of truth for every outbound link and headline claim on the
 * site. Nothing here is aspirational — if a number appears on the page it is
 * countable in the repository, and if a package is listed it is published.
 */
export const site = {
  name: 'VPSGUI',
  version: '1.0.0',
  tagline: 'Open Infrastructure Workspace',
  description:
    'A self-hosted control plane for Linux servers and Docker. Real telemetry, a real host shell, and no invented data.',
  author: {
    name: 'NotGamerPratham',
    url: 'https://notgamerpratham.com',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
  repo: 'https://github.com/NotGamerPratham/vpsgui',
  issues: 'https://github.com/NotGamerPratham/vpsgui/issues',
  discussions: 'https://github.com/NotGamerPratham/vpsgui/discussions',
  docs: {
    architecture: 'https://github.com/NotGamerPratham/vpsgui/blob/main/docs/ARCHITECTURE.md',
    agentInstall: 'https://github.com/NotGamerPratham/vpsgui/blob/main/docs/AGENT_INSTALLATION.md',
    apiReference: 'https://github.com/NotGamerPratham/vpsgui/blob/main/docs/API_REFERENCE.md',
    development: 'https://github.com/NotGamerPratham/vpsgui/blob/main/docs/DEVELOPMENT.md',
    security: 'https://github.com/NotGamerPratham/vpsgui/blob/main/docs/SECURITY.md',
  },
  packages: {
    npm: 'https://www.npmjs.com/package/vpsgui-sdk',
    pypi: 'https://pypi.org/project/vpsgui/',
  },
} as const;

/** The one-liner the hero offers to copy. Kept verbatim from the README. */
export const installCommand =
  'git clone https://github.com/NotGamerPratham/vpsgui.git && cd vpsgui && sudo ./run.sh';

/** Agent-only install, for adding a second host to an existing console. */
export const agentInstallCommand =
  'curl -fsSLO https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh';

export const navLinks: NavLink[] = [
  { label: 'Features', href: '/#features' },
  { label: 'Install', href: '/#install' },
  { label: 'API', href: '/api' },
  { label: 'SDKs', href: '/#sdks' },
  { label: 'Security', href: '/security' },
];

export const footerSections: Array<{ title: string; links: NavLink[] }> = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Quickstart', href: '/#install' },
      { label: 'API reference', href: '/api' },
      { label: 'Security model', href: '/security' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Node.js SDK', href: site.packages.npm, external: true },
      { label: 'Python SDK', href: site.packages.pypi, external: true },
      { label: 'Architecture', href: site.docs.architecture, external: true },
      { label: 'Contributing', href: site.docs.development, external: true },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'GitHub', href: site.repo, external: true },
      { label: 'Report an issue', href: site.issues, external: true },
      { label: 'MIT License', href: site.license.url, external: true },
      { label: 'NotGamerPratham', href: site.author.url, external: true },
    ],
  },
];


