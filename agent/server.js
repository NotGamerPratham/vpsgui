/**
 * VPSGUI Agent Server Daemon
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 *
 * Lightweight HTTP daemon serving real host hardware metrics, process stats, Docker containers,
 * systemd units, a confined file browser, and gated shell execution.
 *
 * SECURITY MODEL
 * --------------
 * This daemon exposes privileged host operations. Every endpoint except /health requires a valid
 * bearer token (AGENT_TOKEN). It binds to loopback by default and is expected to sit behind the
 * bundled nginx reverse proxy, which terminates TLS. Do not expose it directly to the internet.
 *
 * Configuration (all optional, via environment):
 *   PORT                      listen port                       (default 46509)
 *   AGENT_HOST                bind address                      (default 127.0.0.1)
 *   AGENT_TOKEN               shared secret bearer token        (default: generated + persisted)
 *   AGENT_ALLOWED_ORIGINS     comma-separated CORS allowlist    (default: none / same-origin only)
 *   AGENT_FILE_ROOTS          comma-separated file-browser roots
 *   AGENT_ENABLE_SHELL        set to "0" to disable /terminal/exec
 *   AGENT_ALLOW_SENSITIVE_FILES  set to "1" to lift the credential-file deny list
 */

'use strict';

const http = require('http');
const os = require('os');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const AGENT_VERSION = '1.5.0';

const PORT = Number.parseInt(process.env.PORT || '46509', 10);
// Bind to loopback by default. The agent grants root-equivalent control of the host, so it must not
// be reachable from the network unless an operator explicitly opts in and fronts it with TLS.
const HOST = process.env.AGENT_HOST || '127.0.0.1';
const TOKEN_FILE = path.join(__dirname, '.agent-token');

const SHELL_ENABLED = process.env.AGENT_ENABLE_SHELL !== '0';
const ALLOW_SENSITIVE_FILES = process.env.AGENT_ALLOW_SENSITIVE_FILES === '1';

// Request/response limits. Without these a single client can exhaust agent memory.
const MAX_JSON_BODY_BYTES = 8 * 1024 * 1024; // /files/write payloads
const MAX_READ_FILE_BYTES = 2 * 1024 * 1024; // largest file the editor will load
const MAX_EXEC_BUFFER_BYTES = 4 * 1024 * 1024; // cap on captured child-process output
const EXEC_TIMEOUT_MS = 10000;
const INSTALL_TIMEOUT_MS = 300000;

// Failed-auth lockout, so the token cannot be brute-forced over the network.
const AUTH_MAX_FAILURES = 10;
const AUTH_LOCKOUT_MS = 5 * 60 * 1000;

const CORS_ORIGINS = (process.env.AGENT_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

// Shared-secret bearer token gating every privileged endpoint. Read from AGENT_TOKEN if set (e.g. by
// install.sh), otherwise generated once and persisted 0600 so it survives restarts. Paste this value
// into the VPSGUI web UI under Settings -> Agent Token.
function getOrCreateAgentToken() {
  const fromEnv = (process.env.AGENT_TOKEN || '').trim();
  if (fromEnv) {
    if (fromEnv.length < 16) {
      console.error('[VPSGUI Agent] AGENT_TOKEN is shorter than 16 characters. Refusing to start with a weak token.');
      process.exit(1);
    }
    return fromEnv;
  }
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const existing = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
      if (existing.length >= 16) return existing;
    }
  } catch (e) {
    console.warn('[VPSGUI Agent] Could not read token file:', e.message);
  }
  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(TOKEN_FILE, generated, { mode: 0o600 });
    fs.chmodSync(TOKEN_FILE, 0o600); // enforce perms even if the file already existed
  } catch (e) {
    console.warn('[VPSGUI Agent] Could not persist token file, using an in-memory token:', e.message);
  }
  return generated;
}

const AGENT_TOKEN = getOrCreateAgentToken();
// Compare fixed-length digests rather than the raw secrets: a length check on the raw value would
// leak the token length, and timingSafeEqual throws on mismatched lengths.
const AGENT_TOKEN_DIGEST = crypto.createHash('sha256').update(AGENT_TOKEN).digest();

const authFailures = new Map(); // ip -> { count, lockedUntil }

function clientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function isLockedOut(ip) {
  const entry = authFailures.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) return true;
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) authFailures.delete(ip);
  return false;
}

function recordAuthFailure(ip) {
  const entry = authFailures.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= AUTH_MAX_FAILURES) {
    entry.lockedUntil = Date.now() + AUTH_LOCKOUT_MS;
    entry.count = 0;
    console.warn(`[VPSGUI Agent] Too many failed auth attempts from ${ip}; locked out for ${AUTH_LOCKOUT_MS / 1000}s`);
  }
  authFailures.set(ip, entry);
}

function isAuthorized(req) {
  const header = req.headers['authorization'] || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const providedDigest = crypto.createHash('sha256').update(match[1].trim()).digest();
  return crypto.timingSafeEqual(providedDigest, AGENT_TOKEN_DIGEST);
}

// Drop lockout entries that have expired so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of authFailures) {
    if (!entry.lockedUntil || entry.lockedUntil <= now) authFailures.delete(ip);
  }
}, 60000).unref();

// ---------------------------------------------------------------------------
// Command execution helpers (async: execSync would block every other request)
// ---------------------------------------------------------------------------

async function run(file, args, opts = {}) {
  const { stdout } = await execFileAsync(file, args, {
    encoding: 'utf-8',
    timeout: opts.timeout || EXEC_TIMEOUT_MS,
    maxBuffer: opts.maxBuffer || MAX_EXEC_BUFFER_BYTES,
    windowsHide: true,
  });
  return stdout;
}

// Only for the explicit user-driven terminal, which is shell-by-design.
async function runShell(command, opts = {}) {
  const shell = os.platform() === 'win32' ? process.env.ComSpec || 'cmd.exe' : '/bin/sh';
  const args = os.platform() === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command];
  return run(shell, args, opts);
}

async function tryRun(file, args, opts) {
  try {
    return await run(file, args, opts);
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Telemetry sampling
// ---------------------------------------------------------------------------

function cpuTimesSnapshot() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const type of Object.keys(cpu.times)) total += cpu.times[type];
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function netBytesSnapshot() {
  if (os.platform() !== 'linux') return null;
  try {
    const data = fs.readFileSync('/proc/net/dev', 'utf-8');
    let rx = 0;
    let tx = 0;
    for (const line of data.split('\n').slice(2)) {
      const [iface, rest] = line.split(':');
      if (!rest) continue;
      if (iface.trim() === 'lo') continue; // loopback is not real throughput
      const cols = rest.trim().split(/\s+/);
      rx += Number.parseInt(cols[0], 10) || 0;
      tx += Number.parseInt(cols[8], 10) || 0;
    }
    return { rx, tx };
  } catch (e) {
    return null;
  }
}

// CPU and network utilisation are rates, not absolute readings. Sampling deltas on a timer gives the
// real current load; reading os.cpus() once yields the average since boot, which barely moves.
let lastCpu = cpuTimesSnapshot();
let lastNet = netBytesSnapshot();
let lastSampleAt = Date.now();
let currentCpuPercent = 0;
let currentNetRxKbps = 0;
let currentNetTxKbps = 0;

function sample() {
  const now = Date.now();
  const elapsedSec = Math.max((now - lastSampleAt) / 1000, 0.001);

  const cpu = cpuTimesSnapshot();
  const totalDelta = cpu.total - lastCpu.total;
  const idleDelta = cpu.idle - lastCpu.idle;
  if (totalDelta > 0) {
    currentCpuPercent = Math.min(100, Math.max(0, Math.round(((totalDelta - idleDelta) / totalDelta) * 100)));
  }
  lastCpu = cpu;

  const net = netBytesSnapshot();
  if (net && lastNet) {
    currentNetRxKbps = Math.max(0, Math.round(((net.rx - lastNet.rx) / 1024) / elapsedSec));
    currentNetTxKbps = Math.max(0, Math.round(((net.tx - lastNet.tx) / 1024) / elapsedSec));
  }
  if (net) lastNet = net;

  lastSampleAt = now;
}

setInterval(sample, 2000).unref();

// Real swap usage percent from /proc/meminfo (Linux only; 0 elsewhere)
function getSwapInfo() {
  if (os.platform() !== 'linux') return { percent: 0, totalBytes: 0 };
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8');
    const totalKb = Number.parseInt((/SwapTotal:\s+(\d+)/.exec(meminfo) || [])[1] || '0', 10);
    const freeKb = Number.parseInt((/SwapFree:\s+(\d+)/.exec(meminfo) || [])[1] || '0', 10);
    if (!totalKb) return { percent: 0, totalBytes: 0 };
    return {
      percent: Math.round(((totalKb - freeKb) / totalKb) * 100),
      totalBytes: totalKb * 1024,
    };
  } catch (e) {
    return { percent: 0, totalBytes: 0 };
  }
}

// Real root filesystem usage via df (Linux/macOS only)
async function getDiskInfo() {
  if (os.platform() === 'win32') return { percent: 0, totalBytes: 0, usedBytes: 0 };
  const output = await tryRun('df', ['-k', '/'], { timeout: 5000 });
  if (!output) return { percent: 0, totalBytes: 0, usedBytes: 0 };
  const lastLine = output.trim().split('\n').pop() || '';
  const cols = lastLine.trim().split(/\s+/);
  const totalKb = Number.parseInt(cols[1], 10) || 0;
  const usedKb = Number.parseInt(cols[2], 10) || 0;
  const percent = Number.parseInt((cols[4] || '').replace('%', ''), 10);
  return {
    percent: Number.isFinite(percent) ? percent : 0,
    totalBytes: totalKb * 1024,
    usedBytes: usedKb * 1024,
  };
}

// Real CPU package temperature where the kernel exposes it; null when unavailable rather than a
// fabricated reading.
function getCpuTempC() {
  if (os.platform() !== 'linux') return null;
  try {
    const base = '/sys/class/thermal';
    for (const entry of fs.readdirSync(base)) {
      if (!entry.startsWith('thermal_zone')) continue;
      const raw = fs.readFileSync(path.join(base, entry, 'temp'), 'utf-8').trim();
      const milli = Number.parseInt(raw, 10);
      if (Number.isFinite(milli) && milli > 0) return Math.round(milli / 1000);
    }
  } catch (e) {
    /* thermal zones unavailable on this host */
  }
  return null;
}

async function getRealTelemetry() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const swap = getSwapInfo();
  const disk = await getDiskInfo();

  return {
    timestamp: new Date().toISOString(),
    // Fields matching the frontend TelemetryPoint contract
    cpuPercent: currentCpuPercent,
    ramPercent: Math.round((usedMem / totalMem) * 100),
    swapPercent: swap.percent,
    diskPercent: disk.percent,
    netRxKbps: currentNetRxKbps,
    netTxKbps: currentNetTxKbps,
    iowaitPercent: 0,
    tempC: getCpuTempC(),
    powerWatts: null,
    // Extra hardware/OS fields used by getNodePayload()
    cpuCores: cpus.length,
    cpuModel: cpus[0]?.model || 'Unknown CPU',
    memoryTotalBytes: totalMem,
    memoryUsedBytes: usedMem,
    memoryFreeBytes: freeMem,
    swapTotalBytes: swap.totalBytes,
    diskTotalBytes: disk.totalBytes,
    diskUsedBytes: disk.usedBytes,
    loadAverage: os.loadavg(),
    uptimeSeconds: Math.round(os.uptime()),
    osName: `${os.type()} ${os.release()}`,
    osPlatform: os.platform(),
    osArch: os.arch(),
    hostname: os.hostname(),
  };
}

// Fetch active system processes via ps on Linux/macOS or tasklist on Windows
async function getRealProcesses() {
  const totalMemMb = os.totalmem() / (1024 * 1024);
  if (os.platform() === 'win32') {
    const output = await tryRun('tasklist', ['/FO', 'CSV', '/NH']);
    if (!output) return [];
    return output
      .trim()
      .split(/\r?\n/)
      .slice(0, 35)
      .map((line, idx) => {
        const parts = line.split('","').map((p) => p.replace(/"/g, ''));
        const memoryKb = Number.parseInt((parts[4] || '0').replace(/[^0-9]/g, ''), 10) || 0;
        const memoryMb = Math.round((memoryKb / 1024) * 10) / 10;
        return {
          pid: Number.parseInt(parts[1], 10) || idx + 1000,
          user: parts[2] || 'system',
          // tasklist does not report per-process CPU; null is honest, 0.5 was invented.
          cpuPercent: null,
          memoryPercent: totalMemMb > 0 ? Math.round((memoryMb / totalMemMb) * 1000) / 10 : 0,
          memoryMb,
          command: parts[0] || 'process',
          threads: null,
          state: 'running',
        };
      });
  }

  const output = await tryRun('ps', ['-eo', 'pid,user,%cpu,%mem,nlwp,stat,comm', '--sort=-%cpu']);
  if (!output) return [];
  return output
    .trim()
    .split('\n')
    .slice(1, 36)
    .map((line) => {
      const cols = line.trim().split(/\s+/);
      const memoryPercent = Number.parseFloat(cols[3]) || 0;
      return {
        pid: Number.parseInt(cols[0], 10) || 0,
        user: cols[1] || 'root',
        cpuPercent: Number.parseFloat(cols[2]) || 0,
        memoryPercent,
        memoryMb: Math.round(totalMemMb * (memoryPercent / 100) * 10) / 10,
        threads: Number.parseInt(cols[4], 10) || 1,
        state: cols[5] || 'unknown',
        command: cols.slice(6).join(' ') || 'process',
      };
    });
}

// ---------------------------------------------------------------------------
// Docker
// ---------------------------------------------------------------------------

// Parse docker's "0.0.0.0:8080->80/tcp, 443/tcp" port format into structured mappings
function parseDockerPorts(portsStr) {
  if (!portsStr) return [];
  return portsStr
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const typeMatch = /\/(tcp|udp)$/i.exec(entry);
      const type = typeMatch ? typeMatch[1].toLowerCase() : 'tcp';
      const withoutType = entry.replace(/\/(tcp|udp)$/i, '');
      const [left, right] = withoutType.split('->');
      const privatePort = Number.parseInt((right || left).split(':').pop(), 10) || 0;
      const publicPort = right ? Number.parseInt(left.split(':').pop(), 10) || 0 : 0;
      return { publicPort, privatePort, type };
    });
}

function parseByteSize(raw) {
  const match = /([\d.]+)\s*(GiB|MiB|KiB|GB|MB|KB|B)/i.exec(raw || '');
  if (!match) return 0;
  const value = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('g')) return value * 1024;
  if (unit.startsWith('k')) return value / 1024;
  if (unit === 'b') return value / (1024 * 1024);
  return value; // MiB / MB
}

// Best-effort live CPU/mem per container via `docker stats`; empty map if unavailable
async function getDockerStatsById() {
  const statsById = Object.create(null);
  const output = await tryRun('docker', ['stats', '--no-stream', '--format', '{{.ID}}|{{.CPUPerc}}|{{.MemUsage}}'], {
    timeout: 15000,
  });
  if (!output) return statsById;
  for (const line of output.trim().split('\n').filter(Boolean)) {
    const [id, cpuStr, memStr] = line.split('|');
    statsById[id] = {
      cpuPercent: Number.parseFloat((cpuStr || '0').replace('%', '')) || 0,
      memoryUsageMb: Math.round(parseByteSize((memStr || '').split('/')[0]) * 10) / 10,
    };
  }
  return statsById;
}

async function getRealDockerContainers() {
  const output = await tryRun('docker', [
    'ps',
    '-a',
    '--format',
    '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}|{{.State}}',
  ]);
  if (!output) return [];
  const statsById = await getDockerStatsById();
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, name, image, status, ports, createdAt, state] = line.split('|');
      const stats = statsById[id] || { cpuPercent: 0, memoryUsageMb: 0 };
      const createdDate = new Date(createdAt);
      return {
        id,
        name,
        image,
        // docker's own State field, rather than substring-matching the human-readable Status.
        state: state || (status && status.startsWith('Up') ? 'running' : 'exited'),
        status,
        ports: parseDockerPorts(ports),
        cpuPercent: stats.cpuPercent,
        memoryUsageMb: stats.memoryUsageMb,
        created: Number.isNaN(createdDate.getTime()) ? null : createdDate.toISOString(),
      };
    });
}

async function getRealDockerImages() {
  const output = await tryRun('docker', [
    'images',
    '--format',
    '{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}|{{.Digest}}',
  ]);
  if (!output) return [];
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, repository, tag, size, createdAt, digest] = line.split('|');
      const createdDate = new Date(createdAt);
      return {
        id,
        repository,
        tag,
        size,
        sizeMb: Math.round(parseByteSize(size) * 10) / 10,
        digest: digest && digest !== '<none>' ? digest : null,
        created: Number.isNaN(createdDate.getTime()) ? null : createdDate.toISOString(),
      };
    });
}

// ---------------------------------------------------------------------------
// Confined filesystem access
// ---------------------------------------------------------------------------

function defaultFileRoots() {
  if (os.platform() === 'win32') return [process.cwd()];
  return ['/etc', '/var/www', '/var/log', '/home', '/opt', '/srv'];
}

const FILE_ROOTS = (process.env.AGENT_FILE_ROOTS
  ? process.env.AGENT_FILE_ROOTS.split(',').map((p) => p.trim()).filter(Boolean)
  : defaultFileRoots()
).map((p) => path.resolve(p));

// Credential material that the file browser refuses to hand out even inside an allowed root.
const SENSITIVE_PATTERNS = [
  /(^|[\\/])shadow$/i,
  /(^|[\\/])gshadow$/i,
  /(^|[\\/])sudoers$/i,
  /(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)$/i,
  /(^|[\\/])\.agent-token$/i,
  /\.(pem|key|pfx|p12)$/i,
];

function isSensitivePath(resolved) {
  if (ALLOW_SENSITIVE_FILES) return false;
  return SENSITIVE_PATTERNS.some((re) => re.test(resolved));
}

function isInsideRoot(resolved) {
  return FILE_ROOTS.some((root) => resolved === root || resolved.startsWith(root + path.sep));
}

/**
 * Resolve a client-supplied path and confine it to the configured roots.
 *
 * Uses realpath on the nearest existing ancestor so that symlinks pointing outside a root (the
 * classic escape from a naive `startsWith` check) are rejected too.
 */
async function resolveSafePath(requestedPath, { mustExist = true } = {}) {
  if (typeof requestedPath !== 'string' || !requestedPath.trim()) {
    return { error: 'A path is required', status: 400 };
  }
  if (requestedPath.includes('\0')) {
    return { error: 'Invalid path', status: 400 };
  }

  const resolved = path.resolve(requestedPath);
  if (!isInsideRoot(resolved)) {
    return { error: 'Path is outside the configured agent file roots', status: 403 };
  }
  if (isSensitivePath(resolved)) {
    return { error: 'Access to credential files is blocked by the agent', status: 403 };
  }

  // Walk up to the nearest existing ancestor and canonicalise it, defeating symlink traversal.
  let probe = resolved;
  let realProbe = null;
  while (true) {
    try {
      realProbe = await fsp.realpath(probe);
      break;
    } catch (e) {
      if (e.code !== 'ENOENT') return { error: 'Path is not accessible', status: 403 };
      const parent = path.dirname(probe);
      if (parent === probe) return { error: 'Path is not accessible', status: 403 };
      probe = parent;
    }
  }

  const realResolved = probe === resolved ? realProbe : path.join(realProbe, path.relative(probe, resolved));
  if (!isInsideRoot(realResolved)) {
    return { error: 'Path resolves outside the configured agent file roots', status: 403 };
  }
  if (isSensitivePath(realResolved)) {
    return { error: 'Access to credential files is blocked by the agent', status: 403 };
  }
  if (mustExist && probe !== resolved) {
    return { error: 'Path not found', status: 404 };
  }

  return { path: realResolved };
}

// Read host directory entries. Deliberately does NOT include file contents: embedding a truncated
// copy of every file in a listing leaks data, is slow, and previously caused the editor to write the
// truncated copy back over the real file.
async function getRealDirectoryContents(targetDir) {
  const items = await fsp.readdir(targetDir, { withFileTypes: true });
  const results = [];
  for (const item of items) {
    const fullPath = path.join(targetDir, item.name);
    let stat = null;
    try {
      stat = await fsp.lstat(fullPath);
    } catch (e) {
      /* entry vanished or is unreadable; report what we know */
    }
    const type = item.isDirectory() ? 'directory' : item.isSymbolicLink() ? 'symlink' : 'file';
    results.push({
      name: item.name,
      path: fullPath,
      type,
      isDirectory: item.isDirectory(),
      size: stat ? stat.size : 0,
      sizeBytes: stat ? stat.size : 0,
      permissions: stat ? '0' + (stat.mode & 0o777).toString(8) : '',
      owner: stat ? String(stat.uid) : '',
      group: stat ? String(stat.gid) : '',
      extension: type === 'file' ? path.extname(item.name).replace(/^\./, '') : undefined,
      modifiedAt: stat ? stat.mtime.toISOString() : null,
      readable: !isSensitivePath(fullPath),
    });
  }
  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return results;
}

// ---------------------------------------------------------------------------
// Packages & services
// ---------------------------------------------------------------------------

async function probeBinary(bin, versionFlag) {
  const locator = os.platform() === 'win32' ? 'where' : 'which';
  const found = await tryRun(locator, [bin], { timeout: 3000 });
  if (!found) return { installed: false, version: null };
  const verOut = await tryRun(bin, [versionFlag || '--version'], { timeout: 5000 });
  if (!verOut) return { installed: true, version: null };
  return { installed: true, version: (verOut.split('\n')[0] || '').trim() || null };
}

const PACKAGE_DEFS = [
  { name: 'curl', bin: 'curl', category: 'cli', description: 'Command line tool for transferring data with URLs' },
  { name: 'git', bin: 'git', category: 'cli', description: 'Distributed version control system' },
  { name: 'htop', bin: 'htop', category: 'cli', description: 'Interactive process viewer for Unix' },
  { name: 'ufw', bin: 'ufw', category: 'security', description: 'Uncomplicated Firewall for Linux' },
  { name: 'certbot', bin: 'certbot', category: 'security', description: "Automated Let's Encrypt SSL certificate tool" },
  { name: 'nginx', bin: 'nginx', category: 'server', description: 'High performance HTTP server and reverse proxy' },
  { name: 'rsync', bin: 'rsync', category: 'cli', description: 'Fast incremental file transfer utility' },
  { name: 'unzip', bin: 'unzip', category: 'cli', description: 'Extraction utility for ZIP archives' },
  { name: 'tree', bin: 'tree', category: 'cli', description: 'Recursive directory listing program' },
  { name: 'jq', bin: 'jq', category: 'cli', description: 'Command-line JSON processor' },
  { name: 'net-tools', bin: 'netstat', category: 'network', description: 'Linux networking utilities (ifconfig, netstat)' },
  { name: 'build-essential', bin: 'gcc', category: 'developer', description: 'Debian meta-package for compiling software (gcc, g++, make)' },
];

const LANGUAGE_DEFS = [
  { name: 'Node.js', bin: 'node', category: 'runtime', description: 'JavaScript runtime built on V8' },
  { name: 'Python', bin: 'python3', category: 'runtime', description: 'High-level programming language' },
  { name: 'Go (Golang)', bin: 'go', category: 'runtime', description: 'Open source programming language by Google' },
  { name: 'Rust', bin: 'rustc', category: 'runtime', description: 'Empowering everyone to build reliable and efficient software' },
  { name: 'PHP', bin: 'php', category: 'runtime', description: 'Popular general-purpose scripting language' },
  { name: 'OpenJDK (Java)', bin: 'java', category: 'runtime', versionFlag: '-version', description: 'Open-source implementation of Java Platform' },
  { name: 'Bun', bin: 'bun', category: 'runtime', description: 'Incredibly fast JavaScript & TypeScript toolkit' },
  { name: 'Deno', bin: 'deno', category: 'runtime', description: 'Modern runtime for JavaScript and TypeScript' },
];

// Real installed-state detection by probing PATH. Probes run concurrently; serially they took
// several seconds and blocked the request.
async function getRealPackages() {
  const [packages, languages] = await Promise.all([
    Promise.all(
      PACKAGE_DEFS.map(async (def) => {
        const probe = await probeBinary(def.bin);
        return { name: def.name, category: def.category, installed: probe.installed, version: probe.version, description: def.description };
      })
    ),
    Promise.all(
      LANGUAGE_DEFS.map(async (def) => {
        const probe = await probeBinary(def.bin, def.versionFlag);
        return {
          name: def.name,
          category: def.category,
          installed: probe.installed,
          version: probe.version,
          binary: def.bin,
          description: def.description,
        };
      })
    ),
  ]);
  return { packages, languages };
}

// Real systemd service units, including genuine boot-time enablement (Linux only).
async function getRealServices() {
  if (os.platform() !== 'linux') return [];
  const output = await tryRun('systemctl', ['list-units', '--type=service', '--all', '--no-legend', '--no-pager', '--plain']);
  if (!output) return [];

  const units = output
    .trim()
    .split('\n')
    .filter(Boolean)
    .slice(0, 80)
    .map((line) => {
      const cols = line.trim().split(/\s+/);
      const name = cols[0] || 'unknown.service';
      const active = cols[2] || 'unknown';
      return {
        id: `svc-${name.replace(/\.service$/, '')}`,
        name,
        alias: cols.slice(4).join(' ') || name,
        status: active === 'active' ? 'active' : active === 'failed' ? 'failed' : 'inactive',
        subState: cols[3] || '',
        category: 'system',
      };
    });

  // `list-units` does not report boot-time enablement, so query it for real instead of guessing
  // from the current active state.
  const enabledOut = await tryRun('systemctl', ['list-unit-files', '--type=service', '--no-legend', '--no-pager', '--plain']);
  const enabledByName = Object.create(null);
  if (enabledOut) {
    for (const line of enabledOut.trim().split('\n').filter(Boolean)) {
      const cols = line.trim().split(/\s+/);
      if (cols[0]) enabledByName[cols[0]] = cols[1] === 'enabled' || cols[1] === 'enabled-runtime';
    }
  }

  return units.map((u) => ({ ...u, enabled: enabledByName[u.name] ?? null }));
}

// ---------------------------------------------------------------------------
// Node payload
// ---------------------------------------------------------------------------

function primaryIpAddress() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
}

async function getNodePayload() {
  const telemetry = await getRealTelemetry();
  return {
    id: `node-${os.hostname()}`,
    name: os.hostname(),
    status: 'online',
    agentStatus: 'healthy',
    agentVersion: AGENT_VERSION,
    location: {
      // Geolocation is resolved client-side from the public IP; the agent does not invent one.
      city: null,
      country: null,
      countryCode: null,
      flagIcon: 'Globe',
      provider: null,
    },
    hardware: {
      cpuCores: telemetry.cpuCores,
      cpuModel: telemetry.cpuModel,
      ramGb: Math.round((telemetry.memoryTotalBytes / 1073741824) * 10) / 10,
      swapGb: Math.round((telemetry.swapTotalBytes / 1073741824) * 10) / 10,
      diskGb: Math.round((telemetry.diskTotalBytes / 1073741824) * 10) / 10,
      diskType: null,
      architecture: telemetry.osArch,
    },
    os: {
      name: telemetry.osName,
      family: telemetry.osPlatform,
      version: os.release(),
      kernel: os.release(),
      uptimeSeconds: telemetry.uptimeSeconds,
    },
    network: {
      ipAddress: primaryIpAddress(),
      publicIp: null, // resolved client-side; the agent cannot know its NAT address
      hostname: os.hostname(),
      sshPort: 22,
    },
    tags: [os.platform(), 'host-system'],
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

// Read a JSON body with a hard size cap, so a client cannot exhaust agent memory.
function parseJsonBody(req, limit = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        // Stop buffering, but leave the socket writable so the caller still gets a real 413
        // instead of a bare connection reset.
        req.pause();
        chunks.length = 0;
        finish({ error: 'Request body too large', status: 413 });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        finish({ body: JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}') });
      } catch (e) {
        finish({ error: 'Malformed JSON body', status: 400 });
      }
    });
    req.on('error', () => finish({ error: 'Request stream error', status: 400 }));
  });
}

function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  // 413 means we stopped reading mid-body; close rather than trying to resync the connection.
  if (status === 413) res.setHeader('Connection', 'close');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    // Host telemetry, file contents and process lists must never sit in a shared or disk cache.
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(JSON.stringify(payload));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin / non-browser client
  if (!CORS_ORIGINS.includes(origin)) {
    // No wildcard: the agent serves privileged host data behind a bearer token, so cross-origin
    // reads are opt-in via AGENT_ALLOWED_ORIGINS only.
    return false;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}

/** Look up a verb on a null-prototype map so `constructor`/`__proto__` cannot smuggle a value through. */
const DOCKER_VERBS = Object.assign(Object.create(null), {
  start: ['start'],
  stop: ['stop'],
  restart: ['restart'],
  remove: ['rm', '-f'],
});
const SERVICE_ACTIONS = Object.assign(Object.create(null), { start: 1, stop: 1, restart: 1, reload: 1 });

function execErrorPayload(e) {
  if (e && e.killed) return 'Command timed out';
  return (e && (e.stderr || e.stdout || e.message)) || 'Command failed';
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  if (!applyCors(req, res)) {
    sendJson(res, 403, { error: 'Origin not allowed' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqUrl;
  try {
    reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (e) {
    sendJson(res, 400, { error: 'Malformed request URL' });
    return;
  }
  const pathname = reqUrl.pathname;
  const method = req.method;

  // Liveness probe: the only unauthenticated route, and it reveals nothing about the host.
  if (pathname === '/api/v1/health' || pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  const ip = clientIp(req);
  if (isLockedOut(ip)) {
    sendJson(res, 429, { error: 'Too many failed authentication attempts. Try again later.' });
    return;
  }
  if (!isAuthorized(req)) {
    recordAuthFailure(ip);
    sendJson(res, 401, { error: 'Unauthorized: missing or invalid agent token' });
    return;
  }
  authFailures.delete(ip);

  // ---- Read-only system state ----
  if (method === 'GET' && pathname === '/api/v1/system/telemetry') {
    sendJson(res, 200, await getRealTelemetry());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/system/processes') {
    sendJson(res, 200, await getRealProcesses());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/system/packages') {
    sendJson(res, 200, await getRealPackages());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/system/services') {
    sendJson(res, 200, await getRealServices());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/docker/containers') {
    sendJson(res, 200, await getRealDockerContainers());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/docker/images') {
    sendJson(res, 200, await getRealDockerImages());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/node') {
    sendJson(res, 200, await getNodePayload());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/nodes') {
    sendJson(res, 200, [await getNodePayload()]);
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/agent/info') {
    sendJson(res, 200, {
      version: AGENT_VERSION,
      shellEnabled: SHELL_ENABLED,
      fileRoots: FILE_ROOTS,
      platform: os.platform(),
    });
    return;
  }

  // ---- Filesystem ----
  if (method === 'GET' && (pathname === '/api/v1/files' || pathname === '/api/v1/file-manager/list')) {
    const requested = reqUrl.searchParams.get('path') || FILE_ROOTS[0];
    const safe = await resolveSafePath(requested);
    if (safe.error) {
      sendJson(res, safe.status, { error: safe.error, roots: FILE_ROOTS });
      return;
    }
    try {
      const stat = await fsp.stat(safe.path);
      if (!stat.isDirectory()) {
        sendJson(res, 400, { error: 'Path is not a directory' });
        return;
      }
      sendJson(res, 200, await getRealDirectoryContents(safe.path));
    } catch (e) {
      sendJson(res, e.code === 'ENOENT' ? 404 : 403, { error: e.message });
    }
    return;
  }

  if (method === 'GET' && pathname === '/api/v1/files/read') {
    const safe = await resolveSafePath(reqUrl.searchParams.get('path'));
    if (safe.error) {
      sendJson(res, safe.status, { error: safe.error });
      return;
    }
    try {
      const stat = await fsp.stat(safe.path);
      if (!stat.isFile()) {
        sendJson(res, 400, { error: 'Path is not a regular file' });
        return;
      }
      if (stat.size > MAX_READ_FILE_BYTES) {
        // Report the truncation explicitly so the editor can refuse to save and avoid
        // overwriting the file with a partial copy.
        const handle = await fsp.open(safe.path, 'r');
        try {
          const buf = Buffer.alloc(MAX_READ_FILE_BYTES);
          const { bytesRead } = await handle.read(buf, 0, MAX_READ_FILE_BYTES, 0);
          sendJson(res, 200, {
            path: safe.path,
            content: buf.subarray(0, bytesRead).toString('utf-8'),
            truncated: true,
            sizeBytes: stat.size,
            editable: false,
          });
        } finally {
          await handle.close();
        }
        return;
      }
      sendJson(res, 200, {
        path: safe.path,
        content: await fsp.readFile(safe.path, 'utf-8'),
        truncated: false,
        sizeBytes: stat.size,
        editable: true,
      });
    } catch (e) {
      sendJson(res, e.code === 'ENOENT' ? 404 : 403, { error: e.message });
    }
    return;
  }

  if (method === 'POST' && pathname === '/api/v1/files/write') {
    const parsed = await parseJsonBody(req);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const { path: targetPath, content } = parsed.body;
    if (typeof content !== 'string') {
      sendJson(res, 400, { success: false, error: 'content must be a string' });
      return;
    }
    const safe = await resolveSafePath(targetPath, { mustExist: false });
    if (safe.error) {
      sendJson(res, safe.status, { success: false, error: safe.error });
      return;
    }
    try {
      const existing = await fsp.stat(safe.path).catch(() => null);
      if (existing && !existing.isFile()) {
        sendJson(res, 400, { success: false, error: 'Target exists and is not a regular file' });
        return;
      }
      // Preserve the original mode; a fresh file defaults to 0600 rather than the umask.
      await fsp.writeFile(safe.path, content, { encoding: 'utf-8', mode: existing ? existing.mode & 0o777 : 0o600 });
      sendJson(res, 200, { success: true, path: safe.path, bytesWritten: Buffer.byteLength(content, 'utf-8') });
    } catch (e) {
      sendJson(res, 500, { success: false, error: e.message });
    }
    return;
  }

  // ---- Shell execution ----
  if (method === 'POST' && pathname === '/api/v1/terminal/exec') {
    if (!SHELL_ENABLED) {
      sendJson(res, 403, { success: false, error: 'Shell execution is disabled on this agent (AGENT_ENABLE_SHELL=0)' });
      return;
    }
    const parsed = await parseJsonBody(req, 64 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const cmd = parsed.body.command;
    if (typeof cmd !== 'string' || !cmd.trim()) {
      sendJson(res, 400, { success: false, error: 'command must be a non-empty string' });
      return;
    }
    try {
      const output = await runShell(cmd, { timeout: EXEC_TIMEOUT_MS });
      sendJson(res, 200, { success: true, command: cmd, output: output || '' });
    } catch (e) {
      sendJson(res, 200, { success: false, command: cmd, output: execErrorPayload(e) });
    }
    return;
  }

  // ---- Package install ----
  if (method === 'POST' && pathname === '/api/v1/system/packages/install') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, output: parsed.error });
      return;
    }
    const { packageName } = parsed.body;
    // Reject anything that is not a plain package name: no flags, paths, or option injection.
    if (typeof packageName !== 'string' || !/^[a-z0-9][a-z0-9_.+-]{0,127}$/i.test(packageName)) {
      sendJson(res, 400, { success: false, output: 'Invalid package name' });
      return;
    }
    try {
      const output = await run('apt-get', ['install', '-y', '--no-install-recommends', '--', packageName], {
        timeout: INSTALL_TIMEOUT_MS,
      });
      sendJson(res, 200, { success: true, output: output.trim() });
    } catch (e) {
      sendJson(res, 200, { success: false, output: execErrorPayload(e) });
    }
    return;
  }

  // ---- Docker container control ----
  if (method === 'POST' && pathname === '/api/v1/docker/containers/action') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, output: parsed.error });
      return;
    }
    const { id, action } = parsed.body;
    const verbArgs = typeof action === 'string' ? DOCKER_VERBS[action] : undefined;
    if (!verbArgs || typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(id)) {
      sendJson(res, 400, { success: false, action, output: 'Invalid action or container id' });
      return;
    }
    try {
      const output = await run('docker', [...verbArgs, '--', id], { timeout: 60000 });
      sendJson(res, 200, { success: true, action, output: output.trim() });
    } catch (e) {
      sendJson(res, 200, { success: false, action, output: execErrorPayload(e) });
    }
    return;
  }

  // ---- systemd service control ----
  if (method === 'POST' && pathname === '/api/v1/system/services/action') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, output: parsed.error });
      return;
    }
    const { name, action } = parsed.body;
    if (typeof action !== 'string' || !SERVICE_ACTIONS[action]) {
      sendJson(res, 400, { success: false, action, output: 'Invalid action' });
      return;
    }
    if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.@-]{0,127}$/.test(name)) {
      sendJson(res, 400, { success: false, action, output: 'Invalid service name' });
      return;
    }
    try {
      const output = await run('systemctl', [action, '--', name], { timeout: 60000 });
      sendJson(res, 200, { success: true, action, output: output.trim() || `Service ${name} ${action} succeeded` });
    } catch (e) {
      sendJson(res, 200, { success: false, action, output: execErrorPayload(e) });
    }
    return;
  }

  sendJson(res, 404, { error: 'Endpoint not found' });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('[VPSGUI Agent] Unhandled request error:', err);
    // Never echo the raw error to the client: stack traces disclose host paths.
    sendJson(res, 500, { error: 'Internal agent error' });
  });
});

// Drop slow-loris style connections that open a socket and never send a complete request.
server.headersTimeout = 20000;
server.requestTimeout = 60000;
server.keepAliveTimeout = 10000;

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

// A daemon that dies on one bad request takes host monitoring down with it.
process.on('uncaughtException', (err) => {
  console.error('[VPSGUI Agent] Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[VPSGUI Agent] Unhandled rejection:', err);
});

function shutdown(signal) {
  console.log(`[VPSGUI Agent] Received ${signal}, shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, HOST, () => {
  console.log(`[VPSGUI Agent Server] v${AGENT_VERSION} listening on http://${HOST}:${PORT}`);
  console.log(`[VPSGUI Agent Server] File roots: ${FILE_ROOTS.join(', ') || '(none)'}`);
  console.log(`[VPSGUI Agent Server] Shell execution: ${SHELL_ENABLED ? 'enabled' : 'disabled'}`);
  if (HOST === '0.0.0.0' || HOST === '::') {
    console.warn('[VPSGUI Agent Server] WARNING: bound to all interfaces. Front this with TLS and a firewall.');
  }
  if (!process.env.AGENT_TOKEN) {
    console.log(`[VPSGUI Agent Server] Agent token (paste into web UI -> Settings -> Agent Token): ${AGENT_TOKEN}`);
  } else {
    console.log('[VPSGUI Agent Server] Using AGENT_TOKEN from the environment.');
  }
});

module.exports = { server };
