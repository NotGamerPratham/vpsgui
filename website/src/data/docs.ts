/**
 * Documentation content, kept as data so the page, its table of contents and
 * the build-time sitemap all read from one place.
 *
 * Every default, limit and variable name below was read out of `agent/server.js`
 * and `agent/install.sh` rather than recalled. If the agent changes, these
 * change with it.
 */

export type DocBlock =
  | { kind: 'p'; text: string }
  | { kind: 'code'; language: string; code: string; filename?: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'note'; tone: 'info' | 'warn' | 'danger'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] };

export interface DocSection {
  id: string;
  title: string;
  /** Grouping label for the sidebar. */
  group: string;
  blocks: DocBlock[];
}

export const docSections: DocSection[] = [
  {
    id: 'overview',
    title: 'How it fits together',
    group: 'Getting started',
    blocks: [
      {
        kind: 'p',
        text: 'VPSGUI is two pieces. The **console** is a static React app - it holds no credentials and talks to nothing but the agent. The **agent** (`vpsgui-agent`) is a Node process on the host that does the actual work: reading `/proc`, shelling out, driving systemd and Docker, and touching the filesystem.',
      },
      {
        kind: 'p',
        text: 'The agent binds to `127.0.0.1:46509` and is not reachable from the network. nginx serves the console and proxies `/api/v1` to it, which means the only thing you expose is nginx.',
      },
      {
        kind: 'code',
        language: 'bash',
        filename: 'request path',
        code: `browser
  |
  |  https://vps.example.com          <- you expose this
  v
nginx  ---- static files ---->  /var/www/vpsgui/dist
  |
  |  proxy_pass /api/v1
  v
vpsgui-agent  127.0.0.1:46509       <- never exposed
  |
  v
the host: /proc, systemd, docker.sock, the filesystem`,
      },
      {
        kind: 'note',
        tone: 'danger',
        text: 'The agent token is root-equivalent. `POST /api/v1/terminal/exec` runs arbitrary commands as the agent user, so anyone with the token and a route to the agent owns the machine.',
      },
    ],
  },
  {
    id: 'requirements',
    title: 'Requirements',
    group: 'Getting started',
    blocks: [
      {
        kind: 'list',
        items: [
          'Linux with **Node.js 18 or newer**, or **Bun 1.2 or newer**. Ubuntu, Debian, CentOS/RHEL, Alpine and Arch are all fine.',
          'Root, or a user who can `sudo`. The installer writes to `/opt`, `/var/www` and the nginx config.',
          'One of `apt`, `dnf`, `apk` or `pacman` for the package views to do anything.',
          '`systemd` for service control, and a reachable Docker socket for the Docker views. Both are optional - those panels report unavailable without them.',
        ],
      },
    ],
  },
  {
    id: 'install',
    title: 'Install',
    group: 'Getting started',
    blocks: [
      {
        kind: 'p',
        text: 'One script installs dependencies, builds the console, publishes it to `/var/www/vpsgui/dist`, installs the agent under pm2 and writes an nginx vhost.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: 'git clone https://github.com/NotGamerPratham/vpsgui.git && cd vpsgui && sudo ./run.sh',
      },
      {
        kind: 'p',
        text: 'Set `VPSGUI_SERVER_NAME` first if the box already serves another site, otherwise the vhost claims `default_server` and collides with it.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: 'sudo VPSGUI_SERVER_NAME=vps.example.com ./run.sh',
      },
      {
        kind: 'p',
        text: 'Re-running the script on an existing install is safe. It preserves the token and file roots already in `agent.env` rather than regenerating them, and it rolls the nginx config back if `nginx -t` fails.',
      },
    ],
  },
  {
    id: 'token',
    title: 'The agent token',
    group: 'Getting started',
    blocks: [
      {
        kind: 'p',
        text: 'The installer generates a token and writes it to `/opt/vpsgui/agent/agent.env`, mode `0600`. Every endpoint except `/api/v1/health` requires it.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: 'sudo cat /opt/vpsgui/agent/agent.env',
      },
      {
        kind: 'p',
        text: 'Paste it into the console under **Settings → Agent Token**. It is kept in `localStorage` under `vpsgui_auth_token` and sent as an `Authorization: Bearer` header. Until you set it, every privileged call answers `401`.',
      },
      {
        kind: 'note',
        tone: 'warn',
        text: 'The sign-in screen is a local profile gate, not authentication. VPSGUI ships no user database, no roles and no permissions - the token plus network reachability is the entire access model.',
      },
      {
        kind: 'p',
        text: 'To rotate it, edit `AGENT_TOKEN` in `agent.env` and restart the agent. Every existing client is logged out immediately.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `sudo nano /opt/vpsgui/agent/agent.env
sudo pm2 restart vpsgui-agent`,
      },
    ],
  },
  {
    id: 'tls',
    title: 'Put it behind TLS',
    group: 'Getting started',
    blocks: [
      {
        kind: 'p',
        text: 'The token travels in a request header. Over plain HTTP anything on the network path can read it, so terminate TLS before signing in from anywhere but the machine itself.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: 'sudo certbot --nginx -d vps.example.com',
      },
      {
        kind: 'p',
        text: 'Then narrow who can reach it at all. A VPN or a firewall allowlist is doing more for you here than anything in the application.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `sudo ufw allow from 10.8.0.0/24 to any port 443 proto tcp
sudo ufw deny 443/tcp`,
      },
    ],
  },
  {
    id: 'additional-hosts',
    title: 'Adding more hosts',
    group: 'Operating it',
    blocks: [
      {
        kind: 'p',
        text: 'Each machine runs its own agent with its own token, so revoking one host never touches the others. Download the installer, read it, then run it.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `curl -fsSLO https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh
less install.sh
sudo bash install.sh`,
      },
      {
        kind: 'note',
        tone: 'warn',
        text: 'Read the script before running it. Piping a remote URL straight into `sudo bash` executes whatever that URL returns at that moment, with no chance to look first.',
      },
    ],
  },
  {
    id: 'configuration',
    title: 'Configuration',
    group: 'Operating it',
    blocks: [
      {
        kind: 'p',
        text: 'Everything lives in `/opt/vpsgui/agent/agent.env`. Restart the agent after editing. Exported environment variables win over the file, which wins over the defaults below.',
      },
      {
        kind: 'table',
        head: ['Variable', 'Default', 'What it does'],
        rows: [
          ['`PORT`', '`46509`', 'Port the agent listens on.'],
          ['`AGENT_HOST`', '`127.0.0.1`', 'Bind address. Leave it on loopback unless you genuinely mean to expose the agent.'],
          ['`AGENT_TOKEN`', 'generated', 'The bearer token. Root-equivalent - treat it as a root password.'],
          ['`AGENT_FILE_ROOTS`', '`/`', 'Comma-separated roots the file manager may touch. Narrow this if you can.'],
          ['`AGENT_ENABLE_SHELL`', '`1`', 'Set to `0` to disable `/terminal/exec` entirely.'],
          ['`AGENT_ALLOW_SENSITIVE_FILES`', '`0`', 'Set to `1` to bypass the credential deny-list. There is rarely a good reason.'],
          ['`AGENT_ALLOWED_ORIGINS`', 'empty', 'Extra CORS origins, comma-separated. Same-origin already works.'],
          ['`AGENT_DEPLOY_ROOTS`', '`/var/www,/opt,/srv,/home`', 'Where deployment scanning looks for git checkouts.'],
          ['`AGENT_BACKUP_DIR`', '`/var/backups/vpsgui`', 'Where backup archives are written.'],
          ['`AGENT_IPINFO_TOKEN`', 'empty', 'Optional ipinfo.io token. Geolocation works without one (1k lookups/day); a free token raises it to 50k/month. Proxied server-side so it never reaches the browser.'],
          ['`AGENT_PROCESS_MANAGER`', '`pm2`', '`pm2` or `systemd`. The installer tears down the other one to avoid a port race.'],
          ['`VPSGUI_SERVER_NAME`', '`_`', 'nginx `server_name` for the generated vhost. Read by `run.sh`, not the agent.'],
        ],
      },
    ],
  },
  {
    id: 'limits',
    title: 'Built-in limits',
    group: 'Operating it',
    blocks: [
      {
        kind: 'p',
        text: 'These are compiled into the agent rather than configurable, because each one exists to stop a single client exhausting the host.',
      },
      {
        kind: 'table',
        head: ['Limit', 'Value', 'Applies to'],
        rows: [
          ['Request body', '8 MB', '`/files/write` and every other JSON POST.'],
          ['File read', '2 MB', 'Larger files come back flagged `truncated`.'],
          ['Command output', '4 MB', 'Captured stdout plus stderr from `/terminal/exec`.'],
          ['Command timeout', '10 s', 'A command still running is killed.'],
          ['Package install timeout', '300 s', '`/system/packages/install`.'],
          ['Failed auth attempts', '10', 'Per client, before lockout.'],
          ['Lockout duration', '5 min', 'How long that client gets `429`.'],
        ],
      },
      {
        kind: 'note',
        tone: 'warn',
        text: 'A file that came back `truncated: true` is also returned `editable: false`. Do not write that content back - it would truncate the real file on disk.',
      },
    ],
  },
  {
    id: 'process-manager',
    title: 'pm2 and systemd',
    group: 'Operating it',
    blocks: [
      {
        kind: 'p',
        text: 'pm2 supervises the agent by default. Set `AGENT_PROCESS_MANAGER=systemd` before installing if you would rather use a unit file; the installer removes whichever supervisor it is not using, so the two never race for port 46509.',
      },
      {
        kind: 'code',
        language: 'bash',
        filename: 'pm2',
        code: `sudo pm2 status
sudo pm2 logs vpsgui-agent --lines 100
sudo pm2 restart vpsgui-agent`,
      },
      {
        kind: 'code',
        language: 'bash',
        filename: 'systemd',
        code: `sudo systemctl status vpsgui-agent
sudo journalctl -u vpsgui-agent -n 100 --no-pager
sudo systemctl restart vpsgui-agent`,
      },
    ],
  },
  {
    id: 'bun',
    title: 'Running the agent on Bun',
    group: 'Operating it',
    blocks: [
      {
        kind: 'p',
        text: 'The installer sets up Node because that is what every distribution packages. The agent also runs unmodified on [Bun](https://bun.sh), which starts faster and ships as a single binary.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `curl -fsSL https://bun.sh/install | bash
sudo bun /opt/vpsgui/agent/server.js`,
      },
      {
        kind: 'p',
        text: 'To make it permanent, point your supervisor at `bun` instead of `node`. Everything else - `agent.env`, the token, the file roots - is unchanged.',
      },
      {
        kind: 'code',
        language: 'bash',
        filename: 'pm2',
        code: `sudo pm2 delete vpsgui-agent
sudo pm2 start /opt/vpsgui/agent/server.js --name vpsgui-agent --interpreter bun
sudo pm2 save`,
      },
      {
        kind: 'note',
        tone: 'info',
        text: 'The two runtimes are not quite identical. `fs.realpath` returns a Windows drive root as `F:` on Bun and `F:\\` on Node, which the agent normalises before its path-confinement check - without that, Bun refused to list its own configured root. CI runs the full suite and the agent under both.',
      },
    ],
  },
  {
    id: 'cli',
    title: 'Command line',
    group: 'Automation',
    blocks: [
      {
        kind: 'p',
        text: 'The same client ships as a `vpsgui` command. Install it from either registry - the two packages are the same CLI and share `~/.vpsgui/config.json`, so it does not matter which one ends up on your `PATH`.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `npm i -g vpsgui
# or
pip install vpsgui`,
      },
      {
        kind: 'p',
        text: '`vpsgui login` asks for the host and the agent token, checks them against the agent, and only then writes them to disk. The token is read with echo off, so it never reaches your shell history or a screen recording.',
      },
      {
        kind: 'code',
        language: 'bash',
        filename: 'first run',
        code: `$ vpsgui login vps.example.com
Agent token: ****************
Verifying https://vps.example.com/api/v1...

Signed in to vps-1
agent    1.6.0 on linux
profile  default
saved    /home/you/.vpsgui/config.json (mode 0600)`,
      },
      {
        kind: 'table',
        head: ['Command', 'What it does'],
        rows: [
          ['`vpsgui login [url]`', 'Save credentials for a host, after checking they work.'],
          ['`vpsgui whoami`', 'Show the active profile and confirm the agent still accepts it.'],
          ['`vpsgui logout`', "Forget this machine's copy of the token."],
          ['`vpsgui status`', 'CPU, memory, disk, and any failing checks.'],
          ['`vpsgui health`', 'Every health check, one per line. Exits non-zero on a red check.'],
          ['`vpsgui ps`', 'Docker containers.'],
          ['`vpsgui ls [path]`', 'List a directory on the host.'],
          ['`vpsgui exec <command>`', "Run a shell command. Exits non-zero when the command does."],
          ['`vpsgui profiles`', 'List saved hosts.'],
          ['`vpsgui use <profile>`', 'Switch the default host.'],
        ],
      },
      {
        kind: 'p',
        text: 'Several hosts are just several profiles. Add `--profile` to any command to act on one without switching.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `vpsgui login vps-2.example.com --profile staging
vpsgui status --profile staging
vpsgui exec --profile staging 'systemctl restart nginx'`,
      },
      {
        kind: 'p',
        text: 'For CI, skip the login step entirely: `VPSGUI_API_URL` and `VPSGUI_AGENT_TOKEN` take precedence over any saved profile, so nothing is written to disk.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `export VPSGUI_API_URL=https://vps.example.com/api/v1
export VPSGUI_AGENT_TOKEN="$AGENT_TOKEN"
vpsgui health`,
      },
      {
        kind: 'note',
        tone: 'danger',
        text: 'Because the token is root-equivalent, `~/.vpsgui/config.json` is written `0600` and `vpsgui exec` is full remote code execution. `vpsgui logout` only removes the copy on this machine - if the token leaked, rotate it on the host.',
      },
    ],
  },
  {
    id: 'sdks',
    title: 'SDKs',
    group: 'Automation',
    blocks: [
      {
        kind: 'p',
        text: 'The console is an ordinary client of the same API. Both SDKs cover every endpoint and read the token from the environment.',
      },
      {
        kind: 'code',
        language: 'typescript',
        filename: 'node',
        code: `import { VpsguiClient } from 'vpsgui';

const client = new VpsguiClient({
  baseUrl: 'https://vps.example.com/api/v1',
  token: process.env.VPSGUI_AGENT_TOKEN!,
});

const telemetry = await client.system.telemetry();
console.log(telemetry.cpuPercent, telemetry.cpuCores);`,
      },
      {
        kind: 'code',
        language: 'python',
        filename: 'python',
        code: `import os
from vpsgui import VpsguiClient

with VpsguiClient(
    base_url="https://vps.example.com/api/v1",
    token=os.environ["VPSGUI_AGENT_TOKEN"],
) as client:
    for c in client.docker.list_containers():
        print(c["name"], c["state"])`,
      },
      {
        kind: 'note',
        tone: 'info',
        text: 'Fields the agent cannot determine come back `null` rather than guessed - `smartHealth` without `smartctl`, database `size` without credentials, `city` for an address ipinfo reports nothing for. Check before formatting.',
      },
    ],
  },
  {
    id: 'updating',
    title: 'Updating',
    group: 'Automation',
    blocks: [
      {
        kind: 'p',
        text: 'Pull and re-run the deploy script. It rebuilds the console, republishes it, reinstalls the agent and reloads nginx, keeping your token and file roots.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `cd /path/to/vpsgui
git pull
sudo ./run.sh`,
      },
      {
        kind: 'note',
        tone: 'warn',
        text: 'Run the script - do not just rebuild the console. The console lives in `/var/www/vpsgui` but the agent runs from `/opt/vpsgui/agent`, and only `run.sh` copies it there. A `git pull` plus `npm run build` leaves you with a new console calling routes the old agent has never heard of, which shows up as `404`s on whole groups of endpoints.',
      },
      {
        kind: 'p',
        text: 'Check what actually ended up on the host. The version the agent reports is the one that counts, not the one in the checkout.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `vpsgui whoami
grep AGENT_VERSION /opt/vpsgui/agent/server.js`,
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    group: 'Automation',
    blocks: [
      {
        kind: 'table',
        head: ['Symptom', 'Cause', 'Fix'],
        rows: [
          ['`401` on every call', 'No token, or the wrong one.', 'Re-read `agent.env` and paste it under Settings → Agent Token.'],
          ['`429` on every call', 'Ten failed auth attempts locked this client out for five minutes.', 'Fix the token, then wait it out. It clears on its own.'],
          ['`502 Bad Gateway`', 'nginx is up but the agent is not.', '`sudo pm2 status`, then check `sudo pm2 logs vpsgui-agent`.'],
          ['`403` on POSTs only', 'Origin does not match what the agent expects.', 'Confirm nginx forwards `$http_host`, or set `AGENT_ALLOWED_ORIGINS`.'],
          ['`404` on CSS and JS', 'The web root holds a stale build.', 'Re-run `sudo ./run.sh` and hard-reload.'],
          ['`404` on `/api/v1/auth/*` or another whole route group', 'The agent is older than the console. Rebuilding the frontend does not touch `/opt/vpsgui/agent`.', 'Re-run `sudo ./run.sh`, which reinstalls the agent, then `sudo pm2 restart vpsgui-agent`.'],
          ['"Path is outside the configured agent file roots"', '`AGENT_FILE_ROOTS` does not cover that path.', 'Widen it in `agent.env` - deliberately, and restart.'],
          ['Docker panels say unavailable', 'No Docker daemon, or the agent user cannot reach the socket.', 'Confirm `docker ps` works as the agent user.'],
        ],
      },
      {
        kind: 'p',
        text: 'Health is the one route that needs no token, which makes it the fastest way to tell whether the agent is alive at all.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `curl -s http://127.0.0.1:46509/api/v1/health
curl -s https://vps.example.com/api/v1/health`,
      },
    ],
  },
  {
    id: 'uninstall',
    title: 'Uninstalling',
    group: 'Automation',
    blocks: [
      {
        kind: 'p',
        text: 'There is no uninstall script. Removing it by hand is four commands, and worth doing in this order so nginx never points at a missing root.',
      },
      {
        kind: 'code',
        language: 'bash',
        code: `sudo rm -f /etc/nginx/sites-enabled/vpsgui /etc/nginx/sites-available/vpsgui
sudo nginx -t && sudo systemctl reload nginx

sudo pm2 delete vpsgui-agent && sudo pm2 save
sudo rm -rf /opt/vpsgui /var/www/vpsgui`,
      },
      {
        kind: 'note',
        tone: 'info',
        text: 'Backups written to `/var/backups/vpsgui` are left alone on purpose. Delete them yourself once you are sure you want them gone.',
      },
    ],
  },
];

/** Sidebar grouping, derived so a new section only has to be added once. */
export const docGroups: Array<{ group: string; sections: DocSection[] }> = docSections.reduce(
  (acc, section) => {
    const existing = acc.find((g) => g.group === section.group);
    if (existing) existing.sections.push(section);
    else acc.push({ group: section.group, sections: [section] });
    return acc;
  },
  [] as Array<{ group: string; sections: DocSection[] }>,
);
