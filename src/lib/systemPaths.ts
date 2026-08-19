/**
 * Human wording for "you are about to edit something the system depends on".
 *
 * The agent decides *whether* a path is system-owned (it resolves symlinks
 * first, so /etc/os-release is correctly seen as /usr/lib/os-release). This
 * module only decides what to *say* about it — a generic "this is a system
 * file" is easy to click past, whereas naming the specific consequence is not.
 */

export interface SystemRisk {
  /** Short label for the badge. */
  label: string;
  /** One sentence naming the actual consequence of getting it wrong. */
  consequence: string;
  /** 'critical' paths can cost you access to the host; 'system' paths cannot. */
  severity: 'system' | 'critical';
}

/** Specific files whose failure mode is worth naming outright. */
const KNOWN: Array<{ match: RegExp; risk: SystemRisk }> = [
  {
    match: /^\/etc\/fstab$/,
    risk: {
      label: 'Mount table',
      severity: 'critical',
      consequence: 'A bad entry here can stop the host booting. Keep a console or rescue session available before saving.',
    },
  },
  {
    match: /^\/etc\/ssh\/sshd_config(\.d\/.*)?$/,
    risk: {
      label: 'SSH daemon config',
      severity: 'critical',
      consequence: 'A syntax error or a wrong Port/PermitRootLogin can lock you out of SSH once sshd reloads. Verify with `sshd -t` before restarting the service.',
    },
  },
  {
    match: /^\/etc\/(passwd|group|subuid|subgid)$/,
    risk: {
      label: 'Account database',
      severity: 'critical',
      consequence: 'Corrupting this can make every account on the host unusable, including your own.',
    },
  },
  {
    match: /^\/etc\/sudoers(\.d\/.*)?$/,
    risk: {
      label: 'Sudo policy',
      severity: 'critical',
      consequence: 'A malformed sudoers file removes sudo for everyone. Validate with `visudo -c` before saving.',
    },
  },
  {
    match: /^\/etc\/(hosts|resolv\.conf|hostname)$/,
    risk: {
      label: 'Name resolution',
      severity: 'critical',
      consequence: 'Getting this wrong can break DNS for the whole host, including package installs and outbound calls.',
    },
  },
  {
    match: /^\/etc\/nginx\//,
    risk: {
      label: 'nginx config',
      severity: 'system',
      consequence: 'nginx refuses to reload on a syntax error and keeps serving the old config. Check with `nginx -t` before reloading.',
    },
  },
  {
    match: /^\/etc\/systemd\/|\.(service|socket|timer|mount|target)$/,
    risk: {
      label: 'systemd unit',
      severity: 'system',
      consequence: 'Run `systemctl daemon-reload` after saving, or systemd keeps using the previous definition.',
    },
  },
  {
    match: /^\/etc\/(crontab|cron\.[a-z]+\/)/,
    risk: {
      label: 'Scheduled jobs',
      severity: 'system',
      consequence: 'A malformed line can stop the whole crontab from running, not just that entry.',
    },
  },
  {
    match: /^\/boot\//,
    risk: {
      label: 'Boot files',
      severity: 'critical',
      consequence: 'These are read by the bootloader and the kernel. A mistake here can leave the host unbootable.',
    },
  },
  {
    match: /^\/(proc|sys)\//,
    risk: {
      label: 'Kernel interface',
      severity: 'critical',
      consequence: 'This is a live kernel interface, not a file on disk. Writing to it changes system behaviour immediately.',
    },
  },
];

/**
 * Describe the risk of editing `path`.
 *
 * `isSystem` comes from the agent, which has already resolved symlinks. Pass it
 * through rather than re-deriving it here: the browser only ever sees the path
 * it asked for, which may be a link pointing somewhere else entirely.
 */
export function describeSystemRisk(path: string, isSystem: boolean): SystemRisk | null {
  const normalised = path.replace(/\\/g, '/');

  for (const { match, risk } of KNOWN) {
    if (match.test(normalised)) return risk;
  }

  if (!isSystem) return null;

  return {
    label: 'System file',
    severity: 'system',
    consequence:
      'This path belongs to the distribution rather than to your application. Package updates may overwrite it, and other services may depend on its current contents.',
  };
}
