import type { EndpointGroup } from '@/types';

/**
 * Mirrors the route table in agent/server.js. Every path below is dispatched by
 * the daemon; nothing is planned or deprecated. All of them are prefixed with
 * /api/v1 and all of them except /health require the bearer token.
 */
export const endpointGroups: EndpointGroup[] = [
  {
    resource: 'Health & node',
    description: 'Liveness, agent build info, and the inventory of hosts this console knows about.',
    routes: [
      { method: 'GET', path: '/health', summary: 'Liveness probe. The only unauthenticated route.' },
      { method: 'GET', path: '/agent/info', summary: 'Agent version, platform and configured roots.' },
      { method: 'GET', path: '/node', summary: 'Identity and specs of the host running this agent.' },
      { method: 'GET', path: '/nodes', summary: 'Every host registered with the console.' },
      { method: 'GET', path: '/health/matrix', summary: 'Per-subsystem health roll-up.' },
      { method: 'GET', path: '/topology', summary: 'Node graph of what reaches what.' },
    ],
  },
  {
    resource: 'System',
    description: 'Live host metrics, the process table, and the package and service managers.',
    routes: [
      { method: 'GET', path: '/system/telemetry', summary: 'CPU, memory, load, disk and network, read from /proc.' },
      { method: 'GET', path: '/system/processes', summary: 'Process table with owner, CPU and RSS.' },
      { method: 'GET', path: '/system/packages', summary: 'Installed packages from the detected package manager.' },
      { method: 'POST', path: '/system/packages/install', summary: 'Install a package via apt, dnf, apk or pacman.' },
      { method: 'GET', path: '/system/services', summary: 'systemd units with load, active and sub state.' },
      { method: 'POST', path: '/system/services/action', summary: 'Start, stop, restart or enable a unit.' },
      { method: 'GET', path: '/users', summary: 'Local accounts with shell and home directory.' },
    ],
  },
  {
    resource: 'Docker',
    description: 'Container and image control through the local Docker socket.',
    routes: [
      { method: 'GET', path: '/docker/containers', summary: 'Containers with state, image and ports.' },
      { method: 'POST', path: '/docker/containers/action', summary: 'Start, stop, restart or remove a container.' },
      { method: 'GET', path: '/docker/images', summary: 'Local images with tags, size and digest.' },
      { method: 'POST', path: '/docker/images/action', summary: 'Remove an image, optionally forced.' },
    ],
  },
  {
    resource: 'Files',
    description:
      'Confined to the configured roots. Paths are resolved with realpath before every call, and credential files are refused even inside an allowed root.',
    routes: [
      { method: 'GET', path: '/files', summary: 'Directory listing with mode, owner, size and mtime.' },
      { method: 'GET', path: '/files/read', summary: 'File contents, flagged truncated past the read cap.' },
      { method: 'POST', path: '/files/write', summary: 'Overwrite a file. Refused for truncated reads.' },
      { method: 'POST', path: '/files/mkdir', summary: 'Create a directory.' },
      { method: 'POST', path: '/files/rename', summary: 'Rename or move within the roots.' },
      { method: 'POST', path: '/files/delete', summary: 'Delete a path, optionally recursive.' },
    ],
  },
  {
    resource: 'Security',
    description: 'Firewall state, SSH key inventory, the audit log, and the encrypted secret store.',
    routes: [
      { method: 'GET', path: '/security/firewall', summary: 'Rules from nftables or ufw.' },
      { method: 'POST', path: '/security/firewall/action', summary: 'Add, delete, enable or disable a rule.' },
      { method: 'GET', path: '/security/ssh-keys', summary: 'authorized_keys entries per user.' },
      { method: 'GET', path: '/security/audit-logs', summary: 'Privileged calls the agent has served.' },
      { method: 'GET', path: '/security/secrets', summary: 'Secret names and metadata. Values stay masked.' },
      { method: 'POST', path: '/security/secrets', summary: 'Create or update a secret, sealed with AES-256-GCM.' },
      { method: 'POST', path: '/security/secrets/reveal', summary: 'Decrypt one secret. Audited.' },
      { method: 'POST', path: '/security/secrets/delete', summary: 'Remove a secret from the store.' },
    ],
  },
  {
    resource: 'Network & storage',
    description: 'Interface inventory, geolocation proxied server-side, block devices and mounts.',
    routes: [
      { method: 'GET', path: '/network/interfaces', summary: 'Interfaces with addresses and counters.' },
      { method: 'GET', path: '/network/ip-info', summary: 'Geolocation proxied so the API token stays server-side.' },
      { method: 'GET', path: '/storage/partitions', summary: 'Block devices, mounts and usage.' },
      { method: 'GET', path: '/proxy/rules', summary: 'Reverse-proxy vhosts the agent can see.' },
      { method: 'GET', path: '/databases', summary: 'Detected database engines and their listeners.' },
    ],
  },
  {
    resource: 'Operations',
    description: 'Deployments, backups, the catalog, workflows and the job queue.',
    routes: [
      { method: 'GET', path: '/deployments', summary: 'Git-backed deployment directories and their HEAD.' },
      { method: 'POST', path: '/deployments/pull', summary: 'Run git pull in a tracked directory.' },
      { method: 'GET', path: '/backups', summary: 'Existing archives with size and creation time.' },
      { method: 'POST', path: '/backups/create', summary: 'Create a tar archive of a path.' },
      { method: 'POST', path: '/backups/restore', summary: 'Extract an archive to a destination.' },
      { method: 'POST', path: '/backups/delete', summary: 'Delete an archive.' },
      { method: 'GET', path: '/catalog', summary: 'One-click stack templates.' },
      { method: 'GET', path: '/automation/workflows', summary: 'Defined workflows and their last run.' },
      { method: 'GET', path: '/queue/jobs', summary: 'Queued and completed agent jobs.' },
    ],
  },
  {
    resource: 'Terminal',
    description: 'Command execution on the host. This is the endpoint that makes the token root-equivalent.',
    routes: [
      { method: 'POST', path: '/terminal/exec', summary: 'Execute a shell command and return stdout, stderr and exit code.' },
    ],
  },
];
