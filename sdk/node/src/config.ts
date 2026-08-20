import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * On-disk credentials for the CLI.
 *
 * The format is shared verbatim with the Python SDK, because `npm i -g vpsgui`
 * and `pip install vpsgui` both put a `vpsgui` executable on PATH and only one
 * of them can win. Sharing the file means it does not matter which one does:
 * whichever binary runs, `vpsgui login` and every other command see the same
 * profiles. Any change here has to land in sdk/python/vpsgui/config.py too.
 */

export const CONFIG_VERSION = 1;

export interface Profile {
  /** Full API root, e.g. https://vps.example.com/api/v1 */
  url: string;
  /** Agent token. Root-equivalent - this is why the file is 0600. */
  token: string;
  /** Recorded at login, for `vpsgui whoami`. Not trusted for anything. */
  hostname?: string;
  agentVersion?: string;
  savedAt?: string;
}

export interface Config {
  version: number;
  current: string;
  profiles: Record<string, Profile>;
}

export function configDir(): string {
  // VPSGUI_CONFIG_DIR exists so CI and tests never touch a real operator's
  // credentials.
  return process.env.VPSGUI_CONFIG_DIR || path.join(os.homedir(), '.vpsgui');
}

export function configPath(): string {
  return path.join(configDir(), 'config.json');
}

function empty(): Config {
  return { version: CONFIG_VERSION, current: 'default', profiles: {} };
}

export async function readConfig(): Promise<Config> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath(), 'utf8');
  } catch (e) {
    // A missing file is the normal state before the first login.
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return empty();
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${configPath()} is not valid JSON. Fix or delete it, then run: vpsgui login`);
  }

  const cfg = parsed as Partial<Config>;
  return {
    version: typeof cfg.version === 'number' ? cfg.version : CONFIG_VERSION,
    current: typeof cfg.current === 'string' ? cfg.current : 'default',
    profiles: cfg.profiles && typeof cfg.profiles === 'object' ? cfg.profiles : {},
  };
}

/**
 * Write the config with owner-only permissions.
 *
 * The mode is set on the temp file before any token reaches the disk; creating
 * it 0644 and chmod-ing afterwards would leave a window where any local user
 * could read the token.
 */
export async function writeConfig(config: Config): Promise<void> {
  const dir = configDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });

  const tmp = path.join(dir, `.config.json.${process.pid}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  await fs.rename(tmp, configPath());

  // rename preserves the temp file's mode, but an existing config.json created
  // by an older version may still be 0644.
  try {
    await fs.chmod(configPath(), 0o600);
  } catch {
    // Windows and some network filesystems do not implement POSIX modes.
  }
}

/**
 * The profile to use, honouring `--profile`, then VPSGUI_PROFILE, then the
 * `current` recorded at the last login.
 */
export function resolveProfileName(config: Config, explicit?: string): string {
  return explicit || process.env.VPSGUI_PROFILE || config.current || 'default';
}

/**
 * Credentials for a command, or null when there is no usable source.
 *
 * The environment wins over the config file so CI can run without a login step,
 * and so an operator can override a saved profile for one command.
 */
export async function loadCredentials(
  explicitProfile?: string,
): Promise<{ url: string; token: string; source: string } | null> {
  const envUrl = process.env.VPSGUI_API_URL;
  const envToken = process.env.VPSGUI_AGENT_TOKEN;
  if (envUrl && envToken) {
    return { url: envUrl, token: envToken, source: 'environment' };
  }

  const config = await readConfig();
  const name = resolveProfileName(config, explicitProfile);
  const profile = config.profiles[name];
  if (!profile || !profile.url || !profile.token) return null;

  return { url: profile.url, token: profile.token, source: `profile "${name}"` };
}

/**
 * Turn what an operator types into an API root.
 *
 * People paste the address bar - "vps.example.com", "http://1.2.3.4:46509",
 * "https://host/api/v1/" - and every one of those should work rather than
 * producing a 404 they have to debug.
 */
export function normaliseUrl(input: string): string {
  let url = input.trim();
  if (!url) throw new Error('Enter the agent URL.');

  if (!/^https?:\/\//i.test(url)) {
    // Bare IPs and localhost are almost always a plain-HTTP agent on the LAN;
    // a hostname typed without a scheme is almost always a public HTTPS one.
    const host = url.split('/')[0].split(':')[0];
    const isLocal =
      host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host);
    url = (isLocal ? 'http://' : 'https://') + url;
  }

  url = url.replace(/\/+$/, '');
  if (!/\/api\/v1$/.test(url)) url += '/api/v1';
  return url;
}
