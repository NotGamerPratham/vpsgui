import { Eye, FileLock2, Fingerprint, Lock, Network, ScrollText, ShieldAlert, Timer } from 'lucide-react';

import type { SecurityPoint } from '@/types';

/**
 * Split deliberately into what the software guarantees and what the operator
 * still owns. Listing only the first half would read as a security story the
 * product cannot actually deliver on its own.
 */
export const securityGuards: SecurityPoint[] = [
  {
    id: 'timing-safe',
    title: 'Timing-safe token comparison',
    body: 'The bearer token is compared as a SHA-256 digest through timingSafeEqual, so response latency does not leak how much of a guess was correct.',
    icon: Fingerprint,
    kind: 'guard',
  },
  {
    id: 'lockout',
    title: 'Per-client failure lockout',
    body: 'Repeated bad tokens lock out the offending client, keyed on the real remote address. The forwarded-for header is only trusted for its rightmost hop, and only from loopback.',
    icon: Timer,
    kind: 'guard',
  },
  {
    id: 'path-confinement',
    title: 'Resolved-path confinement',
    body: 'Every file operation resolves the target with realpath and re-checks it against the configured roots afterwards, so a symlink planted mid-path cannot escape.',
    icon: FileLock2,
    kind: 'guard',
  },
  {
    id: 'deny-list',
    title: 'Credential deny-list',
    body: 'Shadow files, private keys, the agent token file and the encrypted secret store are refused by the file reader even when they sit inside an allowed root.',
    icon: Lock,
    kind: 'guard',
  },
  {
    id: 'aes',
    title: 'Secrets sealed at rest',
    body: 'Stored secrets are encrypted with AES-256-GCM under a key that never leaves the host, and stay masked in every list response until an explicit reveal call.',
    icon: Eye,
    kind: 'guard',
  },
  {
    id: 'audit',
    title: 'Audit trail',
    body: 'Privileged calls are recorded with their caller, path and outcome, and are readable from the console so you can reconstruct what the agent was asked to do.',
    icon: ScrollText,
    kind: 'guard',
  },
];

export const securityDuties: SecurityPoint[] = [
  {
    id: 'tls',
    title: 'Terminate TLS yourself',
    body: 'The token is a bearer header. VPSGUI cannot protect it on the wire — put a certificate in front of the UI before you sign in from outside the machine.',
    icon: ShieldAlert,
    kind: 'duty',
  },
  {
    id: 'network',
    title: 'Gate the network path',
    body: 'There is no user database and no RBAC. A VPN, firewall allowlist or authenticating proxy is what stands between the internet and root on your box.',
    icon: Network,
    kind: 'duty',
  },
];
