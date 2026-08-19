import {
  Activity,
  Boxes,
  FolderTree,
  KeyRound,
  Network,
  Package,
  ShieldCheck,
  TerminalSquare,
  Workflow,
} from 'lucide-react';

import type { Feature } from '@/types';

/**
 * Descriptions here match what the agent actually implements. Where a feature
 * has a real limit (no SSH client, country-level geolocation) the copy says so
 * rather than rounding up — an operator who discovers the gap after install is
 * an operator who stops trusting the rest of the page.
 */
export const features: Feature[] = [
  {
    id: 'telemetry',
    title: 'Telemetry straight off the kernel',
    description:
      'CPU, memory, load, disk and network read from /proc and /sys on every poll. Anything the host cannot answer comes back null and renders as an empty state — never as a plausible-looking number.',
    icon: Activity,
  },
  {
    id: 'terminal',
    title: 'Host terminal',
    description:
      'Run commands on the machine through the token-authenticated agent, with saved snippets and history. It executes on the host directly; there is no SSH client in the loop.',
    icon: TerminalSquare,
  },
  {
    id: 'docker',
    title: 'Docker control',
    description:
      'List, start, stop, restart and remove containers and images through the local Docker socket. Image removal supports the force flag when a tag is still referenced.',
    icon: Boxes,
  },
  {
    id: 'files',
    title: 'File manager with real guardrails',
    description:
      'Browse, read, edit, rename and delete anywhere under the configured roots. Paths are resolved with realpath before every operation, so a symlink cannot walk out of its root.',
    icon: FolderTree,
  },
  {
    id: 'packages',
    title: 'Packages and services',
    description:
      'Detects apt, dnf, apk or pacman and drives the one your distro actually ships. systemd units can be started, stopped, restarted and enabled from the same view.',
    icon: Package,
  },
  {
    id: 'security',
    title: 'Firewall, SSH keys, audit log',
    description:
      'Read and change nftables or ufw rules, review authorized_keys across users, and page through the agent audit log of every privileged call it served.',
    icon: ShieldCheck,
  },
  {
    id: 'secrets',
    title: 'Encrypted secret store',
    description:
      'Secrets are sealed with AES-256-GCM under a key held only by the agent. Values stay masked until an explicit reveal call, and the store file is on the read deny-list.',
    icon: KeyRound,
  },
  {
    id: 'network',
    title: 'Network and topology',
    description:
      'Live interface inventory with addresses and counters, plus a node graph of what is reachable from what. IP geolocation proxies through the agent so the API token never reaches the browser.',
    icon: Network,
  },
  {
    id: 'automation',
    title: 'Deployments, backups, workflows',
    description:
      'Track git-backed deployment directories and pull them, create and restore tar backups of any path, and inspect the queue of jobs the agent has run.',
    icon: Workflow,
  },
];
