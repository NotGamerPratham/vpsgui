import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  CONFIG_VERSION,
  configPath,
  loadCredentials,
  normaliseUrl,
  readConfig,
  resolveProfileName,
  writeConfig,
} from '../sdk/node/src/config';

/**
 * The CLI config is a contract between two published packages: `npm i -g vpsgui`
 * and `pip install vpsgui` both install a binary called `vpsgui`, only one wins
 * on PATH, and both read this file. A drift here means an operator logs in with
 * one and the other cannot see the profile.
 *
 * The Python half of the contract is asserted in sdk/python/tests/test_config.py
 * against the same fixture.
 */

let tempDir: string;
const savedEnv: Record<string, string | undefined> = {};

const ENV_KEYS = ['VPSGUI_CONFIG_DIR', 'VPSGUI_API_URL', 'VPSGUI_AGENT_TOKEN', 'VPSGUI_PROFILE'];

beforeEach(async () => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vpsgui-cli-'));
  process.env.VPSGUI_CONFIG_DIR = tempDir;
});

afterEach(async () => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('normaliseUrl', () => {
  it('appends the API root so pasting the dashboard address works', () => {
    expect(normaliseUrl('https://vps.example.com')).toBe('https://vps.example.com/api/v1');
  });

  it('does not double up when the API root is already there', () => {
    expect(normaliseUrl('https://vps.example.com/api/v1')).toBe('https://vps.example.com/api/v1');
    expect(normaliseUrl('https://vps.example.com/api/v1/')).toBe('https://vps.example.com/api/v1');
  });

  it('assumes plaintext for loopback and bare IPs, TLS for hostnames', () => {
    // An agent on 127.0.0.1 has no certificate; defaulting it to https would
    // make the common local case fail with a TLS error.
    expect(normaliseUrl('127.0.0.1:46509')).toBe('http://127.0.0.1:46509/api/v1');
    expect(normaliseUrl('localhost:46509')).toBe('http://localhost:46509/api/v1');
    expect(normaliseUrl('194.62.248.20:46509')).toBe('http://194.62.248.20:46509/api/v1');
    expect(normaliseUrl('vps.example.com')).toBe('https://vps.example.com/api/v1');
  });

  it('keeps an explicit scheme', () => {
    expect(normaliseUrl('http://vps.example.com')).toBe('http://vps.example.com/api/v1');
  });

  it('rejects an empty URL rather than building "https:///api/v1"', () => {
    expect(() => normaliseUrl('   ')).toThrow();
  });
});

describe('readConfig', () => {
  it('returns an empty config before the first login instead of throwing', async () => {
    const config = await readConfig();
    expect(config).toEqual({ version: CONFIG_VERSION, current: 'default', profiles: {} });
  });

  it('explains itself when the file is corrupt', async () => {
    await fs.writeFile(configPath(), '{ not json');
    await expect(readConfig()).rejects.toThrow(/not valid JSON/);
  });

  it('tolerates a config missing the fields it expects', async () => {
    await fs.writeFile(configPath(), JSON.stringify({ profiles: null }));
    const config = await readConfig();
    expect(config.profiles).toEqual({});
    expect(config.current).toBe('default');
  });
});

describe('writeConfig', () => {
  it('round-trips through the exact JSON shape the Python CLI expects', async () => {
    await writeConfig({
      version: CONFIG_VERSION,
      current: 'prod',
      profiles: {
        prod: {
          url: 'https://vps.example.com/api/v1',
          token: 'secret-token',
          hostname: 'vps-1',
          agentVersion: '1.6.0',
          savedAt: '2026-08-20T12:00:00.000Z',
        },
      },
    });

    const onDisk = JSON.parse(await fs.readFile(configPath(), 'utf8'));
    expect(onDisk).toEqual({
      version: 1,
      current: 'prod',
      profiles: {
        prod: {
          url: 'https://vps.example.com/api/v1',
          token: 'secret-token',
          hostname: 'vps-1',
          agentVersion: '1.6.0',
          savedAt: '2026-08-20T12:00:00.000Z',
        },
      },
    });
  });

  it.runIf(process.platform !== 'win32')('writes the token owner-only', async () => {
    await writeConfig({ version: 1, current: 'a', profiles: { a: { url: 'u', token: 't' } } });
    const stats = await fs.stat(configPath());
    // The file holds a root-equivalent credential; any other local user being
    // able to read it defeats the point of the agent's own 0600 token file.
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it('leaves no temp file behind', async () => {
    await writeConfig({ version: 1, current: 'a', profiles: {} });
    const entries = await fs.readdir(tempDir);
    expect(entries.filter((e) => e.includes('tmp'))).toEqual([]);
  });
});

describe('loadCredentials', () => {
  it('returns null when nothing is configured, so the CLI can say "not signed in"', async () => {
    expect(await loadCredentials()).toBeNull();
  });

  it('prefers the environment so CI needs no login step', async () => {
    await writeConfig({
      version: 1,
      current: 'saved',
      profiles: { saved: { url: 'https://saved/api/v1', token: 'saved-token' } },
    });
    process.env.VPSGUI_API_URL = 'https://ci/api/v1';
    process.env.VPSGUI_AGENT_TOKEN = 'ci-token';

    const creds = await loadCredentials();
    expect(creds).toEqual({ url: 'https://ci/api/v1', token: 'ci-token', source: 'environment' });
  });

  it('ignores a half-configured environment rather than sending an empty token', async () => {
    await writeConfig({
      version: 1,
      current: 'saved',
      profiles: { saved: { url: 'https://saved/api/v1', token: 'saved-token' } },
    });
    process.env.VPSGUI_API_URL = 'https://ci/api/v1';

    const creds = await loadCredentials();
    expect(creds?.token).toBe('saved-token');
  });

  it('reads the profile named by --profile ahead of the current one', async () => {
    await writeConfig({
      version: 1,
      current: 'prod',
      profiles: {
        prod: { url: 'https://prod/api/v1', token: 'prod-token' },
        staging: { url: 'https://staging/api/v1', token: 'staging-token' },
      },
    });

    expect((await loadCredentials('staging'))?.token).toBe('staging-token');
    expect((await loadCredentials())?.token).toBe('prod-token');
  });

  it('treats a profile with no token as unusable', async () => {
    await writeConfig({
      version: 1,
      current: 'broken',
      profiles: { broken: { url: 'https://x/api/v1', token: '' } },
    });
    expect(await loadCredentials()).toBeNull();
  });
});

describe('resolveProfileName', () => {
  it('puts --profile ahead of VPSGUI_PROFILE, and that ahead of the saved current', () => {
    const config = { version: 1, current: 'saved', profiles: {} };
    process.env.VPSGUI_PROFILE = 'from-env';

    expect(resolveProfileName(config, 'from-flag')).toBe('from-flag');
    expect(resolveProfileName(config)).toBe('from-env');

    delete process.env.VPSGUI_PROFILE;
    expect(resolveProfileName(config)).toBe('saved');
  });
});
