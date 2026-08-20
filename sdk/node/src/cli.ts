#!/usr/bin/env node
import * as readline from 'readline';
import { Writable } from 'stream';

import { VpsguiClient, VpsguiError } from './client';
import {
  Config,
  configPath,
  loadCredentials,
  normaliseUrl,
  readConfig,
  resolveProfileName,
  writeConfig,
} from './config';

/**
 * The `vpsgui` command.
 *
 * A deliberately small surface: sign in once, then run the handful of things an
 * operator wants from a terminal without opening the dashboard. Anything richer
 * belongs in a script against the SDK, which is what this shares its config
 * with.
 */

const VERSION = '1.2.0';

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

// Respect NO_COLOR, and never emit escapes when piped - `vpsgui ps | grep` and
// `vpsgui status > log` should produce plain text.
const useColor = process.stdout.isTTY === true && !process.env.NO_COLOR;
const ESC = String.fromCharCode(27);
const paint = (code: string) => (s: string) => (useColor ? ESC + '[' + code + 'm' + s + ESC + '[0m' : s);

const bold = paint('1');
const dim = paint('2');
const red = paint('31');
const green = paint('32');
const yellow = paint('33');
const cyan = paint('36');

function out(line = ''): void {
  process.stdout.write(line + '\n');
}

/** Errors go to stderr so they survive a pipe and do not corrupt parsed output. */
function fail(message: string, hint?: string): never {
  process.stderr.write(`${red('error')} ${message}\n`);
  if (hint) process.stderr.write(`${dim(hint)}\n`);
  process.exit(1);
}

function table(rows: string[][]): void {
  if (rows.length === 0) return;
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] || '').length)));
  rows.forEach((row, rowIndex) => {
    const line = row
      .map((cell, i) => (i === row.length - 1 ? cell : (cell || '').padEnd(widths[i])))
      .join('  ');
    out(rowIndex === 0 ? bold(line) : line);
  });
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Read a secret without echoing it.
 *
 * A muted writable swallows the keystrokes readline would otherwise echo, so
 * the token never lands in a screen recording or a shoulder-surfer's view. It
 * cannot reach the shell history either, which is the main reason this is a
 * prompt rather than an argument.
 */
function promptSecret(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    // Piped input (`echo $TOKEN | vpsgui login`) has nothing to echo anyway.
    return prompt('');
  }

  const muted = new Writable({
    write(chunk, encoding, callback) {
      // Let the question itself through; suppress everything typed after it.
      if (!(muted as unknown as { muting: boolean }).muting) process.stdout.write(chunk, encoding);
      callback();
    },
  });

  const rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
    (muted as unknown as { muting: boolean }).muting = true;
  });
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

interface Args {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      flags[body] = argv[++i];
    } else {
      flags[body] = true;
    }
  }

  return { command: positional.shift() || 'help', positional, flags };
}

function flagString(args: Args, name: string): string | undefined {
  const value = args.flags[name];
  return typeof value === 'string' ? value : undefined;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

async function connect(args: Args): Promise<VpsguiClient> {
  const creds = await loadCredentials(flagString(args, 'profile'));
  if (!creds) {
    fail('Not signed in.', 'Run: vpsgui login');
  }
  return new VpsguiClient({ baseUrl: creds.url, token: creds.token });
}

/** Translate agent failures into something an operator can act on. */
function describe(e: unknown): { message: string; hint?: string } {
  if (e instanceof VpsguiError) {
    if (e.status === 401) {
      return { message: 'The agent rejected the token (401).', hint: 'Run: vpsgui login' };
    }
    // 403 means two unrelated things. Path confinement is by far the more common
    // one, and telling someone to sign in again when the real problem is that
    // /etc is not a configured root sends them down the wrong path entirely.
    if (e.status === 403) {
      if (/root/i.test(e.message)) {
        return {
          message: e.message,
          hint: 'Run `vpsgui whoami` to see which paths this agent allows.',
        };
      }
      return { message: `${e.message} (403)`, hint: 'If this is unexpected, run: vpsgui login' };
    }
    if (e.status === 429) {
      return { message: 'Locked out after repeated failed attempts. Wait a few minutes.' };
    }
    if (e.status === 404) {
      return {
        message: `${e.endpoint} does not exist on this agent (404).`,
        hint: 'The agent is probably older than this CLI. Re-run the installer on the host: sudo ./run.sh',
      };
    }
    if (e.status === 0) {
      return {
        message: `Could not reach the agent: ${e.message}`,
        hint: 'Check the URL, that the agent is running, and that the port is open.',
      };
    }
    return { message: `${e.message} (${e.status})` };
  }
  return { message: e instanceof Error ? e.message : String(e) };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Save credentials for a host, after proving they work.
 *
 * Verifying before writing matters: a saved-but-wrong token turns every later
 * command into a 401 that looks like the agent is broken, and the operator has
 * no way to tell which of the two values they got wrong.
 */
async function cmdLogin(args: Args): Promise<void> {
  const profileName = flagString(args, 'profile') || 'default';

  const rawUrl = args.positional[0] || flagString(args, 'url') || (await prompt('Agent URL: '));
  let url: string;
  try {
    url = normaliseUrl(rawUrl);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }

  // --token exists for automation, but it lands in shell history, so the
  // interactive path stays the default and the docs only show that one.
  let token = flagString(args, 'token') || process.env.VPSGUI_AGENT_TOKEN || '';
  if (!token) {
    out(dim('The agent token is under Settings in the dashboard. It grants root-equivalent control.'));
    token = await promptSecret('Agent token: ');
  }
  if (!token) fail('No token entered.');

  out(dim(`Verifying ${url}...`));
  const client = new VpsguiClient({ baseUrl: url, token });

  let info;
  try {
    info = await client.info();
  } catch (e) {
    const { message, hint } = describe(e);
    fail(message, hint);
  }

  // Nice-to-have; a host that answers /agent/info but not /node is still usable.
  let hostname: string | undefined;
  try {
    hostname = (await client.nodes.get()).name;
  } catch {
    hostname = undefined;
  }

  const config = await readConfig();
  config.profiles[profileName] = {
    url,
    token,
    hostname,
    agentVersion: info.version,
    savedAt: new Date().toISOString(),
  };
  config.current = profileName;
  await writeConfig(config);

  out();
  out(`${green('Signed in')} to ${bold(hostname || url)}`);
  out(`${dim('agent')}    ${info.version} on ${info.platform}`);
  out(`${dim('profile')}  ${profileName}`);
  // NTFS ignores POSIX modes, so only claim the file is locked down where
  // that is actually true.
  const modeNote = process.platform === 'win32' ? '' : dim(' (mode 0600)');
  out(`${dim('saved')}    ${configPath()}${modeNote}`);
  if (!info.shellEnabled) {
    out(dim('Shell execution is disabled on this agent, so `vpsgui exec` will not work.'));
  }
}

async function cmdLogout(args: Args): Promise<void> {
  const config = await readConfig();
  const name = resolveProfileName(config, flagString(args, 'profile'));

  if (args.flags.all) {
    const count = Object.keys(config.profiles).length;
    config.profiles = {};
    config.current = 'default';
    await writeConfig(config);
    out(`Removed ${count} profile${count === 1 ? '' : 's'}.`);
    return;
  }

  if (!config.profiles[name]) {
    out(`No profile named "${name}".`);
    return;
  }

  delete config.profiles[name];
  if (config.current === name) {
    config.current = Object.keys(config.profiles)[0] || 'default';
  }
  await writeConfig(config);
  out(`Removed profile "${name}".`);
  out(dim('The token is gone from this machine. It is still valid on the host - rotate it there if it leaked.'));
}

async function cmdWhoami(args: Args): Promise<void> {
  const creds = await loadCredentials(flagString(args, 'profile'));
  if (!creds) {
    out('Not signed in.');
    out(dim('Run: vpsgui login'));
    process.exitCode = 1;
    return;
  }

  out(`${dim('url')}     ${creds.url}`);
  out(`${dim('source')}  ${creds.source}`);

  const client = new VpsguiClient({ baseUrl: creds.url, token: creds.token });
  try {
    const [info, node] = await Promise.all([client.info(), client.nodes.get()]);
    out(`${dim('host')}    ${node.name}`);
    out(`${dim('agent')}   ${info.version} on ${info.platform}`);
    out(`${dim('roots')}   ${info.fileRoots.join(', ')}`);
    out(green('Token accepted.'));
  } catch (e) {
    const { message, hint } = describe(e);
    out(`${yellow('Saved, but not working:')} ${message}`);
    if (hint) out(dim(hint));
    process.exitCode = 1;
  }
}

async function cmdProfiles(): Promise<void> {
  const config: Config = await readConfig();
  const names = Object.keys(config.profiles);
  if (names.length === 0) {
    out('No profiles. Run: vpsgui login');
    return;
  }

  const rows = [['', 'PROFILE', 'HOST', 'URL', 'AGENT']];
  for (const name of names) {
    const p = config.profiles[name];
    rows.push([
      name === config.current ? '*' : ' ',
      name,
      p.hostname || '-',
      p.url,
      p.agentVersion || '-',
    ]);
  }
  table(rows);
}

async function cmdUse(args: Args): Promise<void> {
  const name = args.positional[0];
  if (!name) fail('Which profile?', 'Usage: vpsgui use <profile>');

  const config = await readConfig();
  if (!config.profiles[name]) {
    fail(`No profile named "${name}".`, `Known: ${Object.keys(config.profiles).join(', ') || 'none'}`);
  }
  config.current = name;
  await writeConfig(config);
  out(`Now using "${name}" (${config.profiles[name].hostname || config.profiles[name].url}).`);
}

function bar(percent: number): string {
  const width = 20;
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
  const glyph = '#'.repeat(filled) + '-'.repeat(width - filled);
  const colour = percent >= 90 ? red : percent >= 70 ? yellow : green;
  return colour(glyph);
}

async function cmdStatus(args: Args): Promise<void> {
  const client = await connect(args);
  try {
    const [node, telemetry, health] = await Promise.all([
      client.nodes.get(),
      client.system.telemetry(),
      client.nodes.health(),
    ]);

    const uptimeHours = Math.floor(node.os.uptimeSeconds / 3600);
    const uptime =
      uptimeHours >= 24
        ? `${Math.floor(uptimeHours / 24)}d ${uptimeHours % 24}h`
        : `${uptimeHours}h`;

    out(bold(node.name));
    out(dim(`${node.os.name} ${node.os.version} - kernel ${node.os.kernel} - up ${uptime}`));
    out();
    out(`cpu   ${bar(telemetry.cpuPercent)} ${String(telemetry.cpuPercent).padStart(3)}%  ${dim(`${node.hardware.cpuCores} cores`)}`);
    out(`mem   ${bar(telemetry.ramPercent)} ${String(telemetry.ramPercent).padStart(3)}%  ${dim(`${node.hardware.ramGb} GB`)}`);
    out(`disk  ${bar(telemetry.diskPercent)} ${String(telemetry.diskPercent).padStart(3)}%  ${dim(`${node.hardware.diskGb} GB`)}`);

    const failing = health.filter((h) => h.status !== 'green');
    if (failing.length > 0) {
      out();
      out(bold('Checks needing attention'));
      for (const check of failing) {
        const mark = check.status === 'red' ? red('x') : yellow('!');
        out(`  ${mark} ${check.name}${check.message ? dim(` - ${check.message}`) : ''}`);
      }
    }
  } catch (e) {
    const { message, hint } = describe(e);
    fail(message, hint);
  }
}

async function cmdPs(args: Args): Promise<void> {
  const client = await connect(args);
  try {
    const containers = await client.docker.listContainers();
    if (containers.length === 0) {
      out('No containers.');
      return;
    }
    const rows = [['NAME', 'IMAGE', 'STATUS', 'CPU', 'MEM']];
    for (const c of containers) {
      rows.push([
        c.name,
        c.image,
        c.status,
        c.cpuPercent == null ? '-' : `${c.cpuPercent}%`,
        c.memoryUsageMb ? `${c.memoryUsageMb} MB` : '-',
      ]);
    }
    table(rows);
  } catch (e) {
    const { message, hint } = describe(e);
    fail(message, hint);
  }
}

async function cmdExec(args: Args): Promise<void> {
  const command = args.positional.join(' ');
  if (!command) fail('Nothing to run.', 'Usage: vpsgui exec "systemctl status nginx"');

  const client = await connect(args);
  try {
    const result = await client.terminal.exec(command);
    if (result.output) process.stdout.write(result.output.endsWith('\n') ? result.output : result.output + '\n');
    // Mirror the remote command's disposition, so `vpsgui exec ... && next`
    // behaves the way it would over ssh.
    if (!result.success) process.exitCode = 1;
  } catch (e) {
    const { message, hint } = describe(e);
    fail(message, hint);
  }
}

async function cmdLs(args: Args): Promise<void> {
  const target = args.positional[0] || '/';
  const client = await connect(args);
  try {
    const items = await client.files.list(target);
    if (items.length === 0) {
      out(dim('(empty)'));
      return;
    }
    const rows = [['TYPE', 'SIZE', 'MODIFIED', 'NAME']];
    for (const item of items) {
      rows.push([
        item.type === 'directory' ? 'dir' : 'file',
        item.type === 'directory' ? '-' : String(item.size ?? '-'),
        item.modifiedAt
          ? new Date(item.modifiedAt).toISOString().slice(0, 16).replace('T', ' ')
          : '-',
        item.type === 'directory' ? cyan(item.name) : item.name,
      ]);
    }
    table(rows);
  } catch (e) {
    const { message, hint } = describe(e);
    fail(message, hint);
  }
}

async function cmdHealth(args: Args): Promise<void> {
  const client = await connect(args);
  try {
    const checks = await client.nodes.health();
    const rows = [['', 'CHECK', 'DETAIL']];
    for (const check of checks) {
      const mark =
        check.status === 'green' ? green('ok') : check.status === 'red' ? red('fail') : yellow('warn');
      rows.push([mark, check.name, check.message || '']);
    }
    table(rows);
    // A red check is a real problem on the host, so exit non-zero and let a
    // monitoring cron treat `vpsgui health` as a probe.
    if (checks.some((c) => c.status === 'red')) process.exitCode = 1;
  } catch (e) {
    const { message, hint } = describe(e);
    fail(message, hint);
  }
}

function cmdHelp(): void {
  out(`${bold('vpsgui')} ${dim(VERSION)} - control a VPSGUI agent from the terminal`);
  out();
  out(bold('Usage'));
  out('  vpsgui <command> [options]');
  out();
  out(bold('Getting started'));
  out(`  login [url]        Save credentials for a host, after checking they work`);
  out(`  logout             Forget this machine's copy of the token`);
  out(`  whoami             Show the active profile and confirm the agent accepts it`);
  out();
  out(bold('Hosts'));
  out(`  profiles           List saved hosts`);
  out(`  use <profile>      Switch the default host`);
  out();
  out(bold('Operations'));
  out(`  status             CPU, memory, disk, and any failing checks`);
  out(`  health             Every health check, one per line`);
  out(`  ps                 Docker containers`);
  out(`  ls [path]          List a directory on the host`);
  out(`  exec <command>     Run a shell command on the host`);
  out();
  out(bold('Options'));
  out(`  --profile <name>   Act on a specific saved host`);
  out(`  --url <url>        Agent URL, for login`);
  out(`  --token <token>    Agent token, for login ${dim('(ends up in shell history)')}`);
  out(`  --version          Print the version`);
  out();
  out(bold('Environment'));
  out(`  VPSGUI_API_URL, VPSGUI_AGENT_TOKEN   Use instead of a saved profile`);
  out(`  VPSGUI_PROFILE                       Default profile name`);
  out(`  VPSGUI_CONFIG_DIR                    Override ~/.vpsgui`);
  out(`  NO_COLOR                             Disable colour`);
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags.version || args.command === 'version') {
    out(VERSION);
    return;
  }
  if (args.flags.help) {
    cmdHelp();
    return;
  }

  switch (args.command) {
    case 'login':
      return cmdLogin(args);
    case 'logout':
      return cmdLogout(args);
    case 'whoami':
    case 'me':
      return cmdWhoami(args);
    case 'profiles':
      return cmdProfiles();
    case 'use':
      return cmdUse(args);
    case 'status':
      return cmdStatus(args);
    case 'health':
      return cmdHealth(args);
    case 'ps':
      return cmdPs(args);
    case 'ls':
      return cmdLs(args);
    case 'exec':
    case 'run':
      return cmdExec(args);
    case 'help':
      cmdHelp();
      return;
    default:
      process.stderr.write(`${red('error')} Unknown command "${args.command}".\n`);
      process.stderr.write(dim('Run: vpsgui help\n'));
      process.exit(1);
  }
}

main().catch((e) => {
  const { message, hint } = describe(e);
  fail(message, hint);
});
