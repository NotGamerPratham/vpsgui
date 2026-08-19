import type { QuickstartStep } from '@/types';

import { agentInstallCommand, installCommand } from './site';

export const quickstartSteps: QuickstartStep[] = [
  {
    n: 1,
    title: 'Clone and deploy',
    body: 'One script installs dependencies, builds the frontend, publishes it to the web root, supervises the agent with pm2 and writes the nginx vhost.',
    command: installCommand,
    note: 'Requires root and Node.js 18+.',
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
    note: 'Read the script before running it — piping a remote URL into sudo bash executes whatever it returns at that moment.',
  },
];
