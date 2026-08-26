import type { QuickstartStep } from '@/types';

import { agentInstallCommand, installCommand } from './site';

export const quickstartSteps: QuickstartStep[] = [
  {
    n: 1,
    title: 'Clone and deploy',
    body: 'One script installs dependencies, builds the frontend, publishes it to the web root, supervises the agent with pm2 and writes the nginx vhost. Use the command for your target above.',
    note: 'Requires root and Node.js 18+. The command is not repeated here on purpose: it differs per distro, and two copies drift apart.',
  },
  {
    n: 2,
    title: 'Save the agent token',
    body: 'The installer prints a token on completion. Paste it into the console under Settings, Agent Token. Until you do, every privileged endpoint answers 401.',
    command: 'sudo cat /opt/vpsgui/agent/agent.env',
    note: 'That file is mode 0600 and is the single source of truth for agent settings.',
  },
  {
    n: 3,
    title: 'Put it behind TLS',
    body: 'The token travels as a bearer header. Over plain HTTP anything on the network path can read it, so terminate TLS before you log in from anywhere but localhost.',
    command: 'sudo certbot --nginx -d vps.example.com',
    note: 'Keep the agent on loopback; never publish port 46509.',
  },
  {
    n: 4,
    title: 'Add more hosts',
    body: 'For each extra machine, download the agent installer, read it, then run it as root. Add the resulting host to the console you already have.',
    command: agentInstallCommand,
    note: 'Read the script before running it - piping a remote URL into sudo bash executes whatever it returns at that moment.',
  },
];

/**
 * Install paths, tabbed by target.
 *
 * `run.sh` is Debian-family only and the copy below says so rather than implying broader support:
 * it bootstraps Node from deb.nodesource.com via `apt-get`, and it writes the vhost to
 * /etc/nginx/sites-available with a symlink into sites-enabled - a layout Fedora, RHEL, Arch and
 * Alpine do not ship. Listing them as tabs with the same one-liner would be a claim the installer
 * cannot honour.
 */
export interface InstallTarget {
  id: string;
  label: string;
  /** False when run.sh cannot take this target end to end unaided. */
  supported: boolean;
  /** One entry per shell line: CommandLine renders a single copyable command, not a script. */
  commands: string[];
  /** What actually happens, including what the operator still has to do. */
  note: string;
}

export const installTargets: InstallTarget[] = [
  {
    id: 'debian',
    label: 'Ubuntu / Debian',
    supported: true,
    commands: [installCommand],
    note: 'The supported path. Installs Node 20 from nodesource if missing, builds the console into /var/www/vpsgui, supervises the agent with pm2 and writes the nginx vhost.',
  },
  {
    id: 'other-linux',
    label: 'Other Linux',
    supported: false,
    commands: [
      'sudo dnf install -y nodejs nginx',
      'git clone https://github.com/NotGamerPratham/vpsgui.git && cd vpsgui',
      'sudo ./run.sh',
    ],
    note: 'Install Node 20 and nginx with your own package manager first - run.sh only knows apt-get. It also writes the vhost to /etc/nginx/sites-available, a directory these distros do not create, so copy deploy/nginx.conf to /etc/nginx/conf.d/vpsgui.conf yourself and reload nginx.',
  },
  {
    id: 'agent-only',
    label: 'Extra host (agent only)',
    supported: true,
    commands: [agentInstallCommand],
    note: 'For a machine you want to manage from a console you already run. Download it, read it, then run it as root - it installs the daemon and nothing else.',
  },
];
