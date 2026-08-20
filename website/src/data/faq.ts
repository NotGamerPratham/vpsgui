import type { FaqItem } from '@/types';

/**
 * The awkward questions belong here, answered straight. A FAQ that only asks
 * flattering questions is marketing; this one has to survive someone reading it
 * after they have already installed the thing.
 */
export const faqs: FaqItem[] = [
  {
    id: 'hosted',
    question: 'Is VPSGUI a hosted service?',
    answer:
      'No. There is no VPSGUI cloud, no account to create and no telemetry sent anywhere. You clone the repository onto your own server and run it. The only thing that ever talks to your machine is the agent daemon you installed on it.',
  },
  {
    id: 'token',
    question: 'What exactly does the agent token grant?',
    answer:
      'Root-equivalent control of the host. The agent executes shell commands, installs packages, drives systemd and Docker, and reads and writes files. Anyone holding that token owns the machine, so treat it like a root password: keep it out of version control, serve the UI over HTTPS so it is not sent in the clear, and keep the agent bound to loopback behind the bundled nginx proxy.',
  },
  {
    id: 'auth',
    question: 'Does it have user accounts, roles or permissions?',
    answer:
      'It does not, and this is the most important thing to understand before exposing it. The sign-in screen is a local profile gate stored in your own browser - it is not authentication. VPSGUI ships no user database and no RBAC. The real access control is the agent token plus whatever you put in front of the UI: a VPN, a firewall rule, or an authenticating reverse proxy.',
  },
  {
    id: 'distros',
    question: 'Which distributions are supported?',
    answer:
      'Anything with Node.js 18 or newer and a package manager the agent recognises: apt, dnf, apk or pacman. That covers Ubuntu, Debian, CentOS and RHEL derivatives, Alpine and Arch. systemd is used for service control when present; pm2 supervises the agent itself by default.',
  },
  {
    id: 'mock',
    question: 'What does "zero mock data" actually mean?',
    answer:
      'That a reading you see on screen came from your host or is not shown at all. When the agent cannot determine something - SMART health without smartctl, per-process CPU on Windows, a database size it has no credentials for - it returns null and the UI renders an empty state. It never substitutes a placeholder. A fabricated "healthy" about a real disk is worse than a blank.',
  },
  {
    id: 'multi-host',
    question: 'Can one console manage several servers?',
    answer:
      'Yes. Install the agent on each additional host and add it from the console. Every host runs its own agent with its own token, so revoking one machine never touches the others.',
  },
  {
    id: 'docker',
    question: 'Do I need Docker installed?',
    answer:
      'No. Docker features light up when the daemon is present and the agent can reach its socket; without it those views report that Docker is unavailable and the rest of the workspace works normally.',
  },
  {
    id: 'updates',
    question: 'How do I update an existing install?',
    answer:
      'Pull the repository and run the deploy script again. It rebuilds the frontend, republishes it, reinstalls the agent and reloads nginx, preserving your existing agent token and configured file roots rather than regenerating them.',
  },
  {
    id: 'license',
    question: 'Is it really free, and can I fork it?',
    answer:
      'Yes to both. VPSGUI is MIT licensed with no paid tier, no feature gating and no contributor licence agreement. Fork it, ship it inside your product, or rip out the parts you want.',
  },
];
