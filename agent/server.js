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

const AGENT_VERSION = '1.6.0';

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
function getOrCreateAgentToken()
{
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

/**
 * Identify the caller for rate-limiting purposes.
 *
 * The agent runs behind nginx, so socket.remoteAddress is 127.0.0.1 for EVERY request. Keying the
 * failed-auth lockout on that made it global: one browser with a stale token locked out the whole
 * application for everyone.
 *
 * When the TCP peer is loopback we therefore trust X-Forwarded-For, taking the RIGHTMOST entry —
 * that is the one our own nginx appended from the real peer. Leftmost entries are client-supplied
 * and trivially forged, which would let an attacker evade the lockout or lock out a third party.
 */
function clientIp(req)
{
  const peer = req.socket.remoteAddress || 'unknown';
  const isLoopback = peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
  if (!isLoopback) return peer;

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const hops = forwarded.split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return peer;
}

function isLockedOut(ip)
{
  const entry = authFailures.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) return true;
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) authFailures.delete(ip);
  return false;
}

function recordAuthFailure(ip)
{
  const entry = authFailures.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= AUTH_MAX_FAILURES) {
    entry.lockedUntil = Date.now() + AUTH_LOCKOUT_MS;
    entry.count = 0;
    console.warn(`[VPSGUI Agent] Too many failed auth attempts from ${ip}; locked out for ${AUTH_LOCKOUT_MS / 1000}s`);
  }
  authFailures.set(ip, entry);
}

// ---------------------------------------------------------------------------
// Dashboard accounts and sessions
//
// The sign-in screen used to be a localStorage flag - anyone could set it in
// devtools and reach every page. This makes it real: accounts live on the host,
// passwords are hashed with scrypt, and the browser holds an opaque session
// cookie rather than a credential.
//
// The store is a 0600 JSON file rather than SQLite on purpose. The agent has no
// runtime dependencies, and `node:sqlite` needs Node 22.5 while the documented
// floor is Node 18 - adding either a native module or a version bump to hold a
// handful of rows would cost more than it buys.
//
// The static AGENT_TOKEN keeps working alongside this, because the SDKs and any
// scripts depend on it. It remains root-equivalent.
// ---------------------------------------------------------------------------

const USERS_DB_FILE = path.join(__dirname, 'users.db');

/** scrypt cost. N=16384/r=8 needs ~16 MB per hash, which is inside Node's 32 MB default. */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

const MIN_PASSWORD_LENGTH = 12;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_COOKIE = 'vpsgui_session';

const scryptAsync = promisify(crypto.scrypt);

/**
 * Derive a password hash.
 *
 * Stored as `scrypt$N$r$p$salt$hash` so the parameters travel with the hash and
 * can be raised later without invalidating existing accounts.
 */
async function hashPassword(password, saltHex)
{
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    // scrypt needs roughly 128*N*r bytes; the default cap would reject N=16384.
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Constant-time verification against a stored `scrypt$...` string. */
async function verifyPassword(password, stored)
{
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltHex, hashHex] = parts;
  let derived;
  try {
    derived = await scryptAsync(password, Buffer.from(saltHex, 'hex'), hashHex.length / 2, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
  } catch (e) {
    return false;
  }

  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

/** Read the account store. A missing file means "no accounts yet", not an error. */
async function readUsers()
{
  try {
    const raw = await fsp.readFile(USERS_DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.users) ? parsed.users : [];
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error(`[VPSGUI Agent] Could not read ${USERS_DB_FILE}: ${e.message}`);
    }
    return [];
  }
}

/**
 * Write the account store.
 *
 * Written to a temp file and renamed so a crash mid-write cannot leave a
 * truncated store that locks everyone out. Mode 0600: it holds password hashes.
 */
async function writeUsers(users)
{
  const tmp = `${USERS_DB_FILE}.tmp`;
  const payload = JSON.stringify({ version: 1, users }, null, 2);
  await fsp.writeFile(tmp, payload, { encoding: 'utf-8', mode: 0o600 });
  await fsp.rename(tmp, USERS_DB_FILE);
  // rename preserves the temp file's mode, but be explicit in case it existed.
  await fsp.chmod(USERS_DB_FILE, 0o600).catch(() => { });
}

/** Usernames are compared case-insensitively so "Admin" and "admin" are one account. */
function normaliseUsername(value)
{
  return String(value || '').trim().toLowerCase();
}

function validateCredentials(username, password)
{
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return 'Username must be 3-32 characters: letters, digits, dot, underscore or hyphen';
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > 1024) return 'Password is too long';
  return null;
}

/**
 * A real hash, of a random string nobody knows, verified against when the
 * submitted username does not exist.
 *
 * Without it an unknown username returns immediately while a known one pays for
 * a full scrypt derivation, and that difference is enough to enumerate accounts.
 * Computed once, lazily, so startup is not delayed by it.
 */
let decoyHashPromise = null;
function decoyPasswordHash()
{
  if (!decoyHashPromise) {
    decoyHashPromise = hashPassword(crypto.randomBytes(32).toString('hex'));
  }
  return decoyHashPromise;
}

/* --- Sessions -------------------------------------------------------------
 * Held in memory only. A restart signs everyone out, which is the safer
 * default and avoids writing session material to disk at all. The map stores a
 * SHA-256 of the token, so a memory dump does not yield usable cookies.
 * ------------------------------------------------------------------------ */

const sessions = new Map(); // sha256(token) -> { userId, username, role, expiresAt }

function sessionKey(token)
{
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(user)
{
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(sessionKey(token), {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function lookupSession(token)
{
  if (!token) return null;
  const key = sessionKey(token);
  const entry = sessions.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  return entry;
}

function destroySession(token)
{
  if (token) sessions.delete(sessionKey(token));
}

/** Drop every session belonging to one user, e.g. after a password change. */
function destroySessionsForUser(userId)
{
  for (const [key, entry] of sessions) {
    if (entry.userId === userId) sessions.delete(key);
  }
}

setInterval(() =>
{
  const now = Date.now();
  for (const [key, entry] of sessions) {
    if (entry.expiresAt <= now) sessions.delete(key);
  }
}, 60000).unref();

/* --- Cookie plumbing ----------------------------------------------------- */

function parseCookies(req)
{
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

/**
 * True when the request reached us over TLS.
 *
 * The agent itself is plain HTTP on loopback; nginx terminates TLS and reports
 * it in X-Forwarded-Proto. Marking the cookie Secure on a plain-HTTP deployment
 * would stop it being sent at all, so it is conditional.
 */
function requestIsHttps(req)
{
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https';
}

function setSessionCookie(res, req, token)
{
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    // Strict is what makes this CSRF-resistant: a cross-site POST carries no
    // cookie at all, so no separate CSRF token is needed.
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (requestIsHttps(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res, req)
{
  const attrs = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (requestIsHttps(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

/**
 * True when the caller presents the static agent token.
 *
 * Unchanged: this is what the SDKs and any scripts use, and it remains
 * root-equivalent. Dashboard sessions are checked separately.
 */
function hasAgentToken(req)
{
  const header = req.headers['authorization'] || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const providedDigest = crypto.createHash('sha256').update(match[1].trim()).digest();
  return crypto.timingSafeEqual(providedDigest, AGENT_TOKEN_DIGEST);
}

/**
 * Resolve who is calling: a signed-in dashboard user, or the static token.
 *
 * Returns null when neither applies. The session cookie is HttpOnly, so a
 * cross-site script cannot read it, and SameSite=Strict means a cross-site
 * request never carries it in the first place.
 */
function authenticateRequest(req)
{
  const session = lookupSession(parseCookies(req)[SESSION_COOKIE]);
  if (session) return { kind: 'session', user: session };
  if (hasAgentToken(req)) return { kind: 'token', user: null };
  return null;
}

function isAuthorized(req)
{
  return authenticateRequest(req) !== null;
}

// Drop lockout entries that have expired so the map cannot grow without bound.
setInterval(() =>
{
  const now = Date.now();
  for (const [ip, entry] of authFailures) {
    if (!entry.lockedUntil || entry.lockedUntil <= now) authFailures.delete(ip);
  }
}, 60000).unref();

// ---------------------------------------------------------------------------
// Command execution helpers (async: execSync would block every other request)
// ---------------------------------------------------------------------------

async function run(file, args, opts = {})
{
  const { stdout } = await execFileAsync(file, args, {
    encoding: 'utf-8',
    timeout: opts.timeout || EXEC_TIMEOUT_MS,
    maxBuffer: opts.maxBuffer || MAX_EXEC_BUFFER_BYTES,
    windowsHide: true,
    ...(opts.env ? { env: opts.env } : {}),
  });
  return stdout;
}

// stdout and stderr together. `java -version` writes to stderr, as do several
// other tools, so probing them through run() alone reported them as installed
// with an unknown version.
async function runCombined(file, args, opts = {})
{
  const { stdout, stderr } = await execFileAsync(file, args, {
    encoding: 'utf-8',
    timeout: opts.timeout || EXEC_TIMEOUT_MS,
    maxBuffer: opts.maxBuffer || MAX_EXEC_BUFFER_BYTES,
    windowsHide: true,
    ...(opts.env ? { env: opts.env } : {}),
  });
  return `${stdout || ''}${stderr || ''}`;
}

async function tryRunCombined(file, args, opts)
{
  try {
    return await runCombined(file, args, opts);
  } catch (e) {
    // Some tools exit non-zero while still printing their version.
    const merged = `${(e && e.stdout) || ''}${(e && e.stderr) || ''}`;
    return merged.trim() ? merged : null;
  }
}

// Only for the explicit user-driven terminal, which is shell-by-design.
async function runShell(command, opts = {})
{
  const shell = os.platform() === 'win32' ? process.env.ComSpec || 'cmd.exe' : '/bin/sh';
  const args = os.platform() === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command];
  return run(shell, args, opts);
}

async function tryRun(file, args, opts)
{
  try {
    return await run(file, args, opts);
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Telemetry sampling
// ---------------------------------------------------------------------------

function cpuTimesSnapshot()
{
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const type of Object.keys(cpu.times)) total += cpu.times[type];
    idle += cpu.times.idle;
  }
  return { idle, total };
}

/** Per-interface cumulative byte counters from /proc/net/dev (Linux only). */
function perInterfaceBytes()
{
  if (os.platform() !== 'linux') return null;
  try {
    const data = fs.readFileSync('/proc/net/dev', 'utf-8');
    const byIface = Object.create(null);
    for (const line of data.split('\n').slice(2)) {
      const [iface, rest] = line.split(':');
      if (!rest) continue;
      const cols = rest.trim().split(/\s+/);
      byIface[iface.trim()] = {
        rx: Number.parseInt(cols[0], 10) || 0,
        tx: Number.parseInt(cols[8], 10) || 0,
      };
    }
    return byIface;
  } catch (e) {
    return null;
  }
}

function netBytesSnapshot()
{
  const byIface = perInterfaceBytes();
  if (!byIface) return null;
  let rx = 0;
  let tx = 0;
  for (const [name, counters] of Object.entries(byIface)) {
    if (name === 'lo') continue; // loopback is not real throughput
    rx += counters.rx;
    tx += counters.tx;
  }
  return { rx, tx };
}

// Per-interface throughput, sampled on the same timer as the aggregate counters.
let lastIfaceBytes = perInterfaceBytes();
let lastIfaceSampleAt = Date.now();
let ifaceSpeeds = Object.create(null);

function sampleInterfaceSpeeds()
{
  const current = perInterfaceBytes();
  if (!current) return;
  const now = Date.now();
  const elapsedSec = Math.max((now - lastIfaceSampleAt) / 1000, 0.001);

  if (lastIfaceBytes) {
    const next = Object.create(null);
    for (const [name, counters] of Object.entries(current)) {
      const prev = lastIfaceBytes[name];
      if (!prev) continue;
      next[name] = {
        // Bytes/s -> megabits/s.
        rxSpeedMbps: Math.max(0, Math.round((((counters.rx - prev.rx) / elapsedSec) * 8) / 1e6 * 100) / 100),
        txSpeedMbps: Math.max(0, Math.round((((counters.tx - prev.tx) / elapsedSec) * 8) / 1e6 * 100) / 100),
      };
    }
    ifaceSpeeds = next;
  }

  lastIfaceBytes = current;
  lastIfaceSampleAt = now;
}

// CPU and network utilisation are rates, not absolute readings. Sampling deltas on a timer gives the
// real current load; reading os.cpus() once yields the average since boot, which barely moves.
let lastCpu = cpuTimesSnapshot();
let lastNet = netBytesSnapshot();
let lastSampleAt = Date.now();
let currentCpuPercent = 0;
let currentNetRxKbps = 0;
let currentNetTxKbps = 0;

function sample()
{
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

setInterval(() =>
{
  sample();
  sampleInterfaceSpeeds();
}, 2000).unref();

// Real swap usage percent from /proc/meminfo (Linux only; 0 elsewhere)
function getSwapInfo()
{
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
async function getDiskInfo()
{
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
function getCpuTempC()
{
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

async function getRealTelemetry()
{
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
async function getRealProcesses()
{
  const totalMemMb = os.totalmem() / (1024 * 1024);
  if (os.platform() === 'win32') {
    const output = await tryRun('tasklist', ['/FO', 'CSV', '/NH']);
    if (!output) return [];
    return output
      .trim()
      .split(/\r?\n/)
      .slice(0, 35)
      .map((line, idx) =>
      {
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
    .map((line) =>
    {
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
function parseDockerPorts(portsStr)
{
  if (!portsStr) return [];
  return portsStr
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) =>
    {
      const typeMatch = /\/(tcp|udp)$/i.exec(entry);
      const type = typeMatch ? typeMatch[1].toLowerCase() : 'tcp';
      const withoutType = entry.replace(/\/(tcp|udp)$/i, '');
      const [left, right] = withoutType.split('->');
      const privatePort = Number.parseInt((right || left).split(':').pop(), 10) || 0;
      const publicPort = right ? Number.parseInt(left.split(':').pop(), 10) || 0 : 0;
      return { publicPort, privatePort, type };
    });
}

function parseByteSize(raw)
{
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
async function getDockerStatsById()
{
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

async function getRealDockerContainers()
{
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
    .map((line) =>
    {
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

async function getRealDockerImages()
{
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
    .map((line) =>
    {
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

/**
 * Directories the file browser may reach when AGENT_FILE_ROOTS is unset.
 *
 * Defaults to the whole filesystem. VPSGUI is a host administration tool and operators expect to
 * reach any path; a narrow list simply produced "Path is outside the configured agent file roots"
 * for ordinary work. Narrow it via AGENT_FILE_ROOTS to reduce blast radius - for example
 * AGENT_FILE_ROOTS=/etc,/var/www,/home,/opt,/srv.
 *
 * The credential deny list (shadow, sudoers, SSH private keys, the agent's own token and secret
 * key) still applies regardless of the roots, so those stay unreadable even at '/'.
 */
function defaultFileRoots()
{
  if (os.platform() === 'win32') return [path.parse(process.cwd()).root];
  return ['/'];
}

const FILE_ROOTS = (process.env.AGENT_FILE_ROOTS
  ? process.env.AGENT_FILE_ROOTS.split(',').map((p) => p.trim()).filter(Boolean)
  : defaultFileRoots()
).map((p) => normaliseRoot(path.resolve(p)));

// Credential material that the file browser refuses to hand out even inside an allowed root.
const SENSITIVE_PATTERNS = [
  /(^|[\\/])shadow$/i,
  /(^|[\\/])gshadow$/i,
  /(^|[\\/])sudoers$/i,
  /(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)$/i,
  /(^|[\\/])\.agent-token$/i,
  /\.(pem|key|pfx|p12)$/i,
  // The agent's own configuration and secret store. With AGENT_FILE_ROOTS defaulting to "/" these
  // are reachable by path, and serving them would hand over the bearer token and every stored
  // secret in a single request.
  /(^|[\\/])agent\.env$/i,
  /(^|[\\/])\.secrets\.json$/i,
  /(^|[\\/])\.secrets-key$/i,
  // Dashboard account store. scrypt hashes rather than plaintext, but still
  // credential material, and reachable by path once AGENT_FILE_ROOTS is "/".
  /(^|[\\/])users\.db$/i,
];

function isSensitivePath(resolved)
{
  if (ALLOW_SENSITIVE_FILES) return false;
  return SENSITIVE_PATTERNS.some((re) => re.test(resolved));
}

/**
 * Paths owned by the distribution and the running system rather than by the operator.
 *
 * Editing one of these is legitimate - changing sshd_config or an nginx vhost is the whole point of
 * the tool - but it is the kind of edit that takes a host off the network if it goes wrong. The flag
 * exists so the UI can say so before the write, not to block it.
 */
const SYSTEM_PREFIXES = os.platform() === 'win32'
  ? [process.env.SystemRoot || 'C:\Windows', 'C:\Program Files', 'C:\Program Files (x86)']
  : ['/bin', '/boot', '/dev', '/etc', '/lib', '/lib32', '/lib64', '/libx32', '/proc', '/run',
    '/sbin', '/sys', '/usr', '/var/lib', '/var/log'];

/**
 * True when `resolved` sits inside a system-owned tree. Expects an already-resolved real path.
 *
 * Comparison is case-insensitive on Windows, where the filesystem is. SystemRoot reports
 * "C:\WINDOWS" while a directory listing yields "C:\Windows", so a case-sensitive match flagged
 * nothing under the Windows directory at all.
 */
function isSystemPath(resolved)
{
  const fold = (value) => (os.platform() === 'win32' ? value.toLowerCase() : value);
  const target = fold(resolved);

  return SYSTEM_PREFIXES.some((prefix) =>
  {
    const root = fold(path.resolve(prefix));
    if (target === root) return true;
    return target.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
  });
}

/**
 * Put a drive root back into its canonical "X:\\" form.
 *
 * Node's realpath returns "F:\\" for a Windows drive root; Bun's returns "F:".
 * Both are the same directory, but the bare form fails every prefix comparison
 * below, so running the agent under Bun refused to list a drive root at all.
 * POSIX is unaffected: "/" is its own separator and has no bare variant.
 */
function normaliseRoot(value)
{
  return /^[A-Za-z]:$/.test(value) ? value + path.sep : value;
}

function isInsideRoot(rawResolved)
{
  const resolved = normaliseRoot(rawResolved);
  return FILE_ROOTS.some((root) =>
  {
    if (resolved === root) return true;
    // A root that is already a directory root ("/" on POSIX, "C:\" on Windows) ends in a separator.
    // Appending another produced "//", which matched nothing - configuring AGENT_FILE_ROOTS=/
    // rejected every path except "/" itself. The separator is still required for non-root entries so
    // that "/etc" does not also match a sibling like "/etcetera".
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    return resolved.startsWith(prefix);
  });
}

/**
 * Resolve a client-supplied path and confine it to the configured roots.
 *
 * Uses realpath on the nearest existing ancestor so that symlinks pointing outside a root (the
 * classic escape from a naive `startsWith` check) are rejected too.
 */
async function resolveSafePath(requestedPath, { mustExist = true } = {})
{
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

  // normaliseRoot matters here as well as in the containment check: on Windows a
  // bare "F:" means "the current directory on drive F", not the drive root, so
  // handing it to stat() would silently operate on the wrong directory.
  const realResolved = normaliseRoot(
    probe === resolved ? realProbe : path.join(realProbe, path.relative(probe, resolved)),
  );
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
async function getRealDirectoryContents(targetDir)
{
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
      // Lets the browser mark distribution-owned paths without a read per entry.
      system: isSystemPath(fullPath),
    });
  }
  results.sort((a, b) =>
  {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return results;
}

// ---------------------------------------------------------------------------
// Packages & services
// ---------------------------------------------------------------------------

/**
 * PATH to probe binaries with.
 *
 * A service does not inherit the PATH a login shell builds. Bun installs to
 * ~/.bun/bin, Deno to ~/.deno/bin, Rust to ~/.cargo/bin and Go to
 * /usr/local/go/bin - all of which .bashrc adds for an interactive session and
 * systemd/pm2 never sees. The result was `bun -v` working over ssh while this
 * agent reported Bun as not installed on the very same host.
 *
 * The process PATH stays first, so an operator's own configuration still wins.
 */
const PROBE_PATH = (() =>
{
  if (os.platform() === 'win32') return process.env.PATH || '';

  const home = os.homedir() || '/root';
  const candidates = [
    '/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin', '/sbin', '/bin',
    '/snap/bin',
    '/usr/local/go/bin',
    path.join(home, '.bun', 'bin'),
    path.join(home, '.deno', 'bin'),
    path.join(home, '.cargo', 'bin'),
    path.join(home, '.local', 'bin'),
  ];

  const seen = new Set();
  const parts = [];
  for (const entry of String(process.env.PATH || '').split(path.delimiter).concat(candidates)) {
    if (entry && !seen.has(entry)) {
      seen.add(entry);
      parts.push(entry);
    }
  }
  return parts.join(path.delimiter);
})();

/**
 * The version number out of a tool's banner.
 *
 * Banners are wildly inconsistent - "v22.23.2", "Python 3.14.4", "go version
 * go1.22.0 linux/amd64", 'openjdk version "17.0.9" 2023-10-17'. Rendering the
 * raw first line gave a mix of formats, several of which the cards truncated
 * mid-word. Falls back to the first line when nothing version-shaped is present,
 * because a banner we cannot parse is still worth more than "version unknown".
 */
function extractVersion(raw)
{
  const text = String(raw || '').trim();
  if (!text) return null;
  const match = /(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.]+)?)/.exec(text);
  if (match) return match[1];
  const firstLine = (text.split('\n')[0] || '').trim();
  return firstLine || null;
}

async function probeBinary(bin, versionArgs)
{
  const env = { ...process.env, PATH: PROBE_PATH };
  const locator = os.platform() === 'win32' ? 'where' : 'which';

  // `bin` may be a list of alternate names for the same tool - python3 on Linux
  // and python on Windows are the same interpreter, and probing only the first
  // reported a real one as missing.
  let found = null;
  for (const candidate of Array.isArray(bin) ? bin : [bin]) {
    found = await tryRun(locator, [candidate], { timeout: 3000, env });
    if (found) break;
  }
  if (!found) return { installed: false, version: null };

  // Invoke the path `which` resolved, not the bare name: the lookup used the
  // augmented PATH, and execFile would otherwise search the process PATH again
  // and fail to find exactly the binaries this exists to catch.
  const resolved = (found.split('\n')[0] || '').trim();
  if (!resolved) return { installed: true, version: null };
  const verOut = await tryRunCombined(resolved, versionArgs || ['--version'], { timeout: 5000, env });
  return { installed: true, version: extractVersion(verOut) };
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
  { name: 'Python', bin: ['python3', 'python'], category: 'runtime', description: 'High-level programming language' },
  { name: 'Go (Golang)', bin: 'go', category: 'runtime', versionArgs: ['version'], description: 'Open source programming language by Google' },
  { name: 'Rust', bin: 'rustc', category: 'runtime', description: 'Empowering everyone to build reliable and efficient software' },
  { name: 'PHP', bin: 'php', category: 'runtime', description: 'Popular general-purpose scripting language' },
  { name: 'OpenJDK (Java)', bin: 'java', category: 'runtime', versionArgs: ['-version'], description: 'Open-source implementation of Java Platform' },
  { name: 'Bun', bin: 'bun', category: 'runtime', description: 'Incredibly fast JavaScript & TypeScript toolkit' },
  { name: 'Deno', bin: 'deno', category: 'runtime', description: 'Modern runtime for JavaScript and TypeScript' },
];

// Real installed-state detection by probing PATH. Probes run concurrently; serially they took
// several seconds and blocked the request.
async function getRealPackages()
{
  const [packages, languages] = await Promise.all([
    Promise.all(
      PACKAGE_DEFS.map(async (def) =>
      {
        const probe = await probeBinary(def.bin);
        return { name: def.name, category: def.category, installed: probe.installed, version: probe.version, description: def.description };
      })
    ),
    Promise.all(
      LANGUAGE_DEFS.map(async (def) =>
      {
        const probe = await probeBinary(def.bin, def.versionArgs);
        return {
          name: def.name,
          category: def.category,
          installed: probe.installed,
          version: probe.version,
          binary: Array.isArray(def.bin) ? def.bin[0] : def.bin,
          description: def.description,
        };
      })
    ),
  ]);
  return { packages, languages };
}

// Real systemd service units, including genuine boot-time enablement (Linux only).
async function getRealServices()
{
  if (os.platform() !== 'linux') return [];
  const output = await tryRun('systemctl', ['list-units', '--type=service', '--all', '--no-legend', '--no-pager', '--plain']);
  if (!output) return [];

  // No cap here. This was `.slice(0, 80)`, which is why a host running 300 units
  // reported exactly 80 services and looked suspiciously round. Silently
  // truncating an inventory is the same failure as inventing one: the operator
  // cannot tell that what they are reading is partial.
  const units = output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) =>
    {
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
// Storage, network, and security inventory
// ---------------------------------------------------------------------------

const BYTES_PER_GB = 1024 ** 3;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Mounted filesystems via `df -PT -B1`.
 *
 * Pseudo-filesystems (tmpfs, devtmpfs, overlay, squashfs...) are filtered out - they are not disks
 * and listing them as storage is misleading.
 */
const PSEUDO_FS = new Set([
  'tmpfs', 'devtmpfs', 'squashfs', 'overlay', 'proc', 'sysfs', 'cgroup', 'cgroup2',
  'devpts', 'securityfs', 'debugfs', 'tracefs', 'pstore', 'efivarfs', 'configfs',
  'fusectl', 'bpf', 'ramfs', 'mqueue', 'hugetlbfs', 'autofs', 'binfmt_misc', 'nsfs',
]);

async function getStoragePartitions()
{
  if (os.platform() === 'win32') return [];
  // -P forces one line per filesystem; -T adds the fs type; -B1 gives exact bytes.
  const output = await tryRun('df', ['-PT', '-B1'], { timeout: 8000 });
  if (!output) return [];

  return output
    .trim()
    .split('\n')
    .slice(1)
    .map((line) =>
    {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 7) return null;
      // Mount points can contain spaces; everything from column 7 onward is the path.
      const [device, fsType, totalRaw, usedRaw, freeRaw, pctRaw] = cols;
      const mountPoint = cols.slice(6).join(' ');
      const totalBytes = Number.parseInt(totalRaw, 10) || 0;
      if (!totalBytes || PSEUDO_FS.has(fsType)) return null;

      const usedBytes = Number.parseInt(usedRaw, 10) || 0;
      const freeBytes = Number.parseInt(freeRaw, 10) || 0;
      const usagePercent = Number.parseInt((pctRaw || '').replace('%', ''), 10);

      return {
        device,
        mountPoint,
        fsType,
        totalGb: round2(totalBytes / BYTES_PER_GB),
        usedGb: round2(usedBytes / BYTES_PER_GB),
        freeGb: round2(freeBytes / BYTES_PER_GB),
        totalBytes,
        usedBytes,
        freeBytes,
        usagePercent: Number.isFinite(usagePercent) ? usagePercent : 0,
        // SMART needs `smartctl` plus raw device access; null rather than a fabricated "passed".
        smartHealth: null,
      };
    })
    .filter(Boolean);
}

/** Network interfaces from the OS, enriched with live throughput where /proc/net/dev exists. */
function getNetworkInterfaces()
{
  const results = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (!addrs || addrs.length === 0) continue;
    const ipv4 = addrs.find((a) => a.family === 'IPv4');
    const ipv6 = addrs.find((a) => a.family === 'IPv6');
    const isLoopback = addrs.every((a) => a.internal);
    const speeds = ifaceSpeeds[name] || { rxSpeedMbps: 0, txSpeedMbps: 0 };
    const counters = lastIfaceBytes?.[name];

    results.push({
      name,
      mac: ipv4?.mac || ipv6?.mac || '',
      ipv4: ipv4?.address || '',
      ipv6: ipv6?.address || '',
      // The OS does not expose the physical medium portably; classify only what is certain.
      type: isLoopback ? 'loopback' : /^(veth|docker|br-|virbr|tun|tap)/.test(name) ? 'virtual' : 'ethernet',
      rxBytes: counters?.rx ?? 0,
      txBytes: counters?.tx ?? 0,
      rxSpeedMbps: speeds.rxSpeedMbps,
      txSpeedMbps: speeds.txSpeedMbps,
      // An interface with an assigned address is up; os.networkInterfaces() omits down ones.
      status: 'up',
    });
  }
  return results;
}

/** ufw rules, parsed from `ufw status numbered`. Empty when ufw is absent or inactive. */
async function getFirewallRules()
{
  if (os.platform() !== 'linux') return [];
  const output = await tryRun('ufw', ['status', 'numbered'], { timeout: 8000 });
  if (!output) return [];

  // `Status: inactive` means the rules exist but are not being enforced.
  const active = /^Status:\s*active/im.test(output);

  const rules = [];
  for (const line of output.split('\n')) {
    // e.g. "[ 1] 22/tcp                     ALLOW IN    Anywhere"
    const match = /^\[\s*(\d+)\]\s+(.+?)\s+(ALLOW|DENY|REJECT|LIMIT)\s+(IN|OUT)\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, index, target, action, direction, source] = match;
    const portProto = /^([0-9:,]+)\/(tcp|udp)$/i.exec(target.trim());
    rules.push({
      id: `ufw-${index}`,
      nodeId: '',
      port: portProto ? portProto[1] : target.trim(),
      protocol: portProto ? portProto[2].toLowerCase() : 'any',
      action: action.toLowerCase(),
      direction: direction.toUpperCase() === 'IN' ? 'inbound' : 'outbound',
      sourceIp: source.trim() || 'Anywhere',
      comment: `ufw rule ${index}`,
      status: active ? 'active' : 'disabled',
    });
  }
  return rules;
}

/**
 * Authorised SSH public keys for the users whose home directories are readable.
 *
 * Only ever reads authorized_keys (public material). Private keys stay behind the
 * credential-file deny list.
 */
async function getSshKeys()
{
  if (os.platform() !== 'linux') return [];

  const candidates = [{ user: 'root', home: '/root' }];
  try {
    for (const entry of await fsp.readdir('/home', { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push({ user: entry.name, home: path.join('/home', entry.name) });
    }
  } catch (e) {
    /* /home unreadable or absent */
  }

  const keys = [];
  for (const { user, home } of candidates) {
    const keyFile = path.join(home, '.ssh', 'authorized_keys');
    let content;
    try {
      content = await fsp.readFile(keyFile, 'utf-8');
    } catch (e) {
      continue;
    }
    content.split('\n').forEach((line, idx) =>
    {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) return;
      const [algorithm, keyBody, ...commentParts] = parts;
      // Fingerprint the key the same way `ssh-keygen -lf` does: base64 sha256 of the raw blob.
      let fingerprint = '';
      try {
        fingerprint = `SHA256:${crypto
          .createHash('sha256')
          .update(Buffer.from(keyBody, 'base64'))
          .digest('base64')
          .replace(/=+$/, '')}`;
      } catch (e) {
        /* malformed key body */
      }
      keys.push({
        id: `${user}-${idx}`,
        user,
        label: commentParts.join(' ') || `${user} key ${idx + 1}`,
        algorithm,
        fingerprint,
        path: keyFile,
      });
    });
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Reverse proxy, databases, catalog
// ---------------------------------------------------------------------------

/**
 * Split an nginx config dump into top-level `server { ... }` blocks by brace depth.
 * A regex cannot do this correctly because blocks nest (server > location > if).
 */
function extractServerBlocks(config)
{
  const blocks = [];
  const re = /\bserver\s*\{/g;
  let match;
  while ((match = re.exec(config)) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < config.length && depth > 0) {
      if (config[i] === '{') depth += 1;
      else if (config[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth === 0) blocks.push(config.slice(re.lastIndex, i - 1));
  }
  return blocks;
}

/** Read a certificate's expiry via openssl. null when unreadable. */
async function certExpiry(certPath)
{
  const out = await tryRun('openssl', ['x509', '-enddate', '-noout', '-in', certPath], { timeout: 5000 });
  if (!out) return null;
  const match = /notAfter=(.+)/.exec(out.trim());
  if (!match) return null;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Reverse-proxy rules, read from the live nginx configuration via `nginx -T`.
 *
 * This reports what nginx is actually serving rather than a separate list the agent would have to
 * keep in sync. Empty when nginx is absent or the config cannot be dumped.
 */
async function getProxyRules()
{
  if (os.platform() === 'win32') return [];
  const config = await tryRun('nginx', ['-T'], { timeout: 10000 });
  if (!config) return [];

  const rules = [];
  let index = 0;

  for (const block of extractServerBlocks(config)) {
    // Strip comments so a commented-out proxy_pass is not reported as live.
    const clean = block.replace(/#[^\n]*/g, '');

    const serverName = (/\bserver_name\s+([^;]+);/.exec(clean) || [])[1]?.trim();
    const proxyPass = (/\bproxy_pass\s+([^;]+);/.exec(clean) || [])[1]?.trim();
    if (!proxyPass) continue; // a plain static-file vhost is not a proxy rule

    const listens = [...clean.matchAll(/\blisten\s+([^;]+);/g)].map((m) => m[1]);
    const ssl = listens.some((l) => /\bssl\b/.test(l)) || /\bssl_certificate\s/.test(clean);
    const certPath = (/\bssl_certificate\s+([^;]+);/.exec(clean) || [])[1]?.trim();

    index += 1;
    rules.push({
      id: `nginx-${index}`,
      // `server_name _;` is nginx's catch-all placeholder, not a real domain.
      domain: !serverName || serverName === '_' ? '(default server)' : serverName.split(/\s+/)[0],
      upstream: proxyPass,
      ssl: ssl ? 'enabled' : 'disabled',
      expires: certPath ? (await certExpiry(certPath)) ?? 'unknown' : '',
      status: 'active',
    });
  }
  return rules;
}

/**
 * Where a new vhost should live on this host.
 *
 * Debian-family nginx uses sites-available + a symlink into sites-enabled;
 * RHEL-family just globs conf.d. Detecting which is present beats writing to
 * both and hoping.
 */
async function nginxVhostTarget(name)
{
  const available = '/etc/nginx/sites-available';
  const enabled = '/etc/nginx/sites-enabled';
  const hasSites = await fsp
    .stat(enabled)
    .then((st) => st.isDirectory())
    .catch(() => false);

  if (hasSites) {
    return { file: path.join(available, name), link: path.join(enabled, name) };
  }
  return { file: path.join('/etc/nginx/conf.d', `${name}.conf`), link: null };
}

/** Reload nginx through whichever mechanism this host provides. */
async function reloadNginx()
{
  const viaSystemd = await tryRun('systemctl', ['reload', 'nginx'], { timeout: 15000 });
  if (viaSystemd !== null) return true;
  return (await tryRun('nginx', ['-s', 'reload'], { timeout: 15000 })) !== null;
}

/**
 * Create an nginx reverse-proxy vhost.
 *
 * The "Add Proxy Host" button was disabled because rules were read-only. This
 * makes it real, with the same discipline run.sh uses for its own vhost: write,
 * test, and delete the file again if `nginx -t` fails. A config that does not
 * parse must never be left on disk, because the next unrelated reload would
 * then fail and take every site on the box down with it.
 */
async function createProxyRule(body)
{
  const domain = String(body?.domain || '').trim();
  const upstream = String(body?.upstream || '').trim();
  const listenPort = Number.parseInt(body?.listenPort ?? 80, 10);
  const websockets = body?.websockets !== false;

  // A domain goes straight into a config file that runs as root. Anything
  // outside this set could close the server block and inject directives.
  if (!/^(\*\.)?[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/.test(domain)) {
    return { status: 400, body: { success: false, error: 'Domain must be a hostname such as app.example.com' } };
  }
  if (domain.length > 253) {
    return { status: 400, body: { success: false, error: 'Domain is too long' } };
  }
  if (!/^https?:\/\/[A-Za-z0-9._-]+(:\d{1,5})?(\/[A-Za-z0-9._~\-/]*)?$/.test(upstream)) {
    return {
      status: 400,
      body: { success: false, error: 'Upstream must look like http://127.0.0.1:3000' },
    };
  }
  if (!Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535) {
    return { status: 400, body: { success: false, error: 'listenPort must be between 1 and 65535' } };
  }

  if (os.platform() !== 'linux') {
    return { status: 400, body: { success: false, error: 'Proxy rules are only managed on Linux hosts' } };
  }

  const name = domain.replace(/^\*\./, 'wildcard.').replace(/[^A-Za-z0-9.-]/g, '');
  const { file, link } = await nginxVhostTarget(name);

  if (await fsp.stat(file).then(() => true).catch(() => false)) {
    return { status: 409, body: { success: false, error: `A vhost already exists at ${file}` } };
  }

  const wsLines = websockets
    ? [
      '        proxy_http_version 1.1;',
      '        proxy_set_header Upgrade $http_upgrade;',
      '        proxy_set_header Connection "upgrade";',
    ]
    : [];

  const conf = [
    '# Managed by VPSGUI. Edit freely; it is a plain nginx config.',
    'server {',
    `    listen ${listenPort};`,
    `    listen [::]:${listenPort};`,
    `    server_name ${domain};`,
    '',
    '    location / {',
    `        proxy_pass ${upstream};`,
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    ...wsLines,
    '    }',
    '}',
    '',
  ].join('\n');

  const created = [];
  try {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, conf, { encoding: 'utf-8', mode: 0o644 });
    created.push(file);

    if (link && !(await fsp.stat(link).then(() => true).catch(() => false))) {
      await fsp.symlink(file, link);
      created.push(link);
    }

    // `nginx -t` exits non-zero on a bad config, which makes run() throw. A
    // thrown error therefore means "invalid or could not be verified", and
    // either way the file must not survive: the next unrelated reload would
    // fail and take every site on the box down with it.
    let testOutput = null;
    try {
      await run('nginx', ['-t'], { timeout: 15000 });
    } catch (e) {
      testOutput = (e && (e.stderr || e.stdout || e.message)) || 'nginx -t failed';
      for (const created_path of created.reverse()) {
        await fsp.rm(created_path, { force: true }).catch(() => { });
      }
      return {
        status: 400,
        body: {
          success: false,
          error: 'nginx rejected the generated config; nothing was left on disk',
          output: String(testOutput).slice(0, 2000),
        },
      };
    }

    const reloaded = await reloadNginx();
    return {
      status: 200,
      body: {
        success: true,
        file,
        enabled: Boolean(link),
        reloaded,
        // Saying so explicitly beats implying the rule is live when it is not.
        note: reloaded ? null : 'Config is valid but nginx could not be reloaded; reload it manually.',
      },
    };
  } catch (e) {
    for (const created_path of created.reverse()) {
      await fsp.rm(created_path, { force: true }).catch(() => { });
    }
    return { status: 500, body: { success: false, error: e.message } };
  }
}

// Database engines detectable from listening sockets. Reporting row/key counts would require
// credentials for each engine, which the agent deliberately does not hold.
const DB_ENGINES = [
  { engine: 'PostgreSQL', port: 5432 },
  { engine: 'MySQL / MariaDB', port: 3306 },
  { engine: 'Redis', port: 6379 },
  { engine: 'MongoDB', port: 27017 },
  { engine: 'Microsoft SQL Server', port: 1433 },
  { engine: 'CouchDB', port: 5984 },
  { engine: 'Memcached', port: 11211 },
];

/** Database servers detected by their listening TCP ports. */
async function getDatabases()
{
  if (os.platform() === 'win32') return [];
  // -H omits the header; without it the "State" column would be parsed as a port.
  const output = await tryRun('ss', ['-tlnH'], { timeout: 8000 });
  if (!output) return [];

  const listeningPorts = new Set();
  for (const line of output.trim().split('\n')) {
    const cols = line.trim().split(/\s+/);
    // Local address is column 4 for `ss -tlnH`, formatted host:port (IPv6 uses [::]:port).
    const local = cols[3];
    if (!local) continue;
    const port = Number.parseInt(local.slice(local.lastIndexOf(':') + 1), 10);
    if (Number.isFinite(port)) listeningPorts.add(port);
  }

  return DB_ENGINES.filter((db) => listeningPorts.has(db.port)).map((db) => ({
    name: db.engine,
    engine: db.engine,
    port: db.port,
    // Size and table/key counts need an authenticated connection per engine; null, not invented.
    size: null,
    tables: null,
    keys: null,
    status: 'running',
  }));
}

/**
 * Curated catalog of self-hostable applications.
 *
 * Unlike the other endpoints this is reference data, not host state, so serving a static list is
 * accurate rather than fabricated: it describes what *can* be deployed, not what is installed.
 */
/**
 * Deployable catalog.
 *
 * Every `image` below was checked against Docker Hub or GHCR, and every URL in
 * an `installCommand` against a live request, before being added. A catalog
 * entry whose command 404s is worse than a shorter catalog, so anything that
 * could not be verified was left out.
 *
 * Items with no container image carry `installCommand` instead, because the UI
 * disables its copy button when neither is present - an OS template with no
 * command would render as a dead button.
 *
 * There is no `plugins` category: VPSGUI has no plugin system, and populating
 * that tab would advertise a feature that does not exist.
 */
const CATALOG_ITEMS = [
  {
    id: 'nginx', name: 'Nginx', category: 'docker_images', version: 'stable-alpine',
    description: 'High performance HTTP server and reverse proxy.',
    iconName: 'Globe', publisher: 'nginx', official: true, tags: ['web', 'proxy'],
    image: 'nginx:stable-alpine', defaultPorts: [80, 443],
  },
  {
    id: 'postgres', name: 'PostgreSQL', category: 'docker_images', version: '16-alpine',
    description: 'Object-relational database system.',
    iconName: 'Database', publisher: 'postgres', official: true, tags: ['database', 'sql'],
    image: 'postgres:16-alpine', defaultPorts: [5432], defaultEnv: { POSTGRES_PASSWORD: 'change-me' },
  },
  {
    id: 'redis', name: 'Redis', category: 'docker_images', version: '7-alpine',
    description: 'In-memory data structure store, cache and message broker.',
    iconName: 'Zap', publisher: 'redis', official: true, tags: ['database', 'cache'],
    image: 'redis:7-alpine', defaultPorts: [6379],
  },
  {
    id: 'mariadb', name: 'MariaDB', category: 'docker_images', version: '11',
    description: 'Community-developed fork of MySQL.',
    iconName: 'Database', publisher: 'mariadb', official: true, tags: ['database', 'sql'],
    image: 'mariadb:11', defaultPorts: [3306], defaultEnv: { MARIADB_ROOT_PASSWORD: 'change-me' },
  },
  {
    id: 'mysql', name: 'MySQL', category: 'docker_images', version: '8',
    description: 'The world\'s most popular open source database.',
    iconName: 'Database', publisher: 'mysql', official: true, tags: ['database', 'sql'],
    image: 'mysql:8', defaultPorts: [3306], defaultEnv: { MYSQL_ROOT_PASSWORD: 'change-me' },
  },
  {
    id: 'mongo', name: 'MongoDB', category: 'docker_images', version: '7',
    description: 'Document-oriented NoSQL database.',
    iconName: 'Database', publisher: 'mongo', official: true, tags: ['database', 'nosql'],
    image: 'mongo:7', defaultPorts: [27017],
  },
  {
    id: 'caddy', name: 'Caddy', category: 'docker_images', version: '2-alpine',
    description: 'Web server with automatic HTTPS via Let\'s Encrypt.',
    iconName: 'Globe', publisher: 'caddy', official: true, tags: ['web', 'proxy', 'tls'],
    image: 'caddy:2-alpine', defaultPorts: [80, 443],
  },
  {
    id: 'traefik', name: 'Traefik', category: 'docker_images', version: 'v3.0',
    description: 'Cloud-native reverse proxy and load balancer.',
    iconName: 'Globe', publisher: 'traefik', official: true, tags: ['proxy', 'ingress'],
    image: 'traefik:v3.0', defaultPorts: [80, 443, 8080],
  },
  {
    id: 'haproxy', name: 'HAProxy', category: 'docker_images', version: '2.9-alpine',
    description: 'Reliable, high performance TCP/HTTP load balancer.',
    iconName: 'Globe', publisher: 'haproxy', official: true, tags: ['proxy', 'loadbalancer'],
    image: 'haproxy:2.9-alpine', defaultPorts: [80, 443],
  },
  {
    id: 'httpd', name: 'Apache HTTP Server', category: 'docker_images', version: '2.4-alpine',
    description: 'The Apache web server.',
    iconName: 'Globe', publisher: 'httpd', official: true, tags: ['web'],
    image: 'httpd:2.4-alpine', defaultPorts: [80],
  },
  {
    id: 'rabbitmq', name: 'RabbitMQ', category: 'docker_images', version: '3-management-alpine',
    description: 'Message broker with the management UI enabled.',
    iconName: 'Radio', publisher: 'rabbitmq', official: true, tags: ['queue', 'messaging'],
    image: 'rabbitmq:3-management-alpine', defaultPorts: [5672, 15672],
  },
  {
    id: 'memcached', name: 'Memcached', category: 'docker_images', version: '1.6-alpine',
    description: 'Distributed memory object caching system.',
    iconName: 'Zap', publisher: 'memcached', official: true, tags: ['cache'],
    image: 'memcached:1.6-alpine', defaultPorts: [11211],
  },
  {
    id: 'influxdb', name: 'InfluxDB', category: 'docker_images', version: '2.7-alpine',
    description: 'Time-series database for metrics and events.',
    iconName: 'BarChart3', publisher: 'influxdb', official: true, tags: ['database', 'metrics'],
    image: 'influxdb:2.7-alpine', defaultPorts: [8086],
  },
  {
    id: 'registry', name: 'Docker Registry', category: 'docker_images', version: '2',
    description: 'Private container image registry.',
    iconName: 'Container', publisher: 'registry', official: true, tags: ['docker', 'registry'],
    image: 'registry:2', defaultPorts: [5000],
  },
  {
    id: 'valkey', name: 'Valkey', category: 'docker_images', version: '8-alpine',
    description: 'Community fork of Redis, drop-in compatible.',
    iconName: 'Zap', publisher: 'valkey', official: false, tags: ['database', 'cache'],
    image: 'valkey/valkey:8-alpine', defaultPorts: [6379],
  },
  {
    id: 'portainer', name: 'Portainer CE', category: 'applications', version: 'latest',
    description: 'Container management UI for Docker.',
    iconName: 'Container', publisher: 'portainer', official: true, tags: ['docker', 'management'],
    image: 'portainer/portainer-ce:latest', defaultPorts: [9443],
  },
  {
    id: 'uptime-kuma', name: 'Uptime Kuma', category: 'applications', version: '1',
    description: 'Self-hosted uptime monitoring with status pages and alerting.',
    iconName: 'Activity', publisher: 'louislam', official: false, tags: ['monitoring'],
    image: 'louislam/uptime-kuma:1', defaultPorts: [3001],
  },
  {
    id: 'gitea', name: 'Gitea', category: 'applications', version: '1',
    description: 'Lightweight self-hosted Git service.',
    iconName: 'GitBranch', publisher: 'gitea', official: true, tags: ['git', 'devops'],
    image: 'gitea/gitea:1', defaultPorts: [3000, 222],
  },
  {
    id: 'nextcloud', name: 'Nextcloud', category: 'applications', version: 'stable',
    description: 'Self-hosted file sync, sharing, and collaboration platform.',
    iconName: 'Cloud', publisher: 'nextcloud', official: true, tags: ['storage', 'files'],
    image: 'nextcloud:stable', defaultPorts: [8080],
  },
  {
    id: 'grafana', name: 'Grafana', category: 'applications', version: 'latest',
    description: 'Dashboards and visualisation for metrics and logs.',
    iconName: 'BarChart3', publisher: 'grafana', official: true, tags: ['monitoring', 'metrics'],
    image: 'grafana/grafana:latest', defaultPorts: [3000],
  },
  {
    id: 'vaultwarden', name: 'Vaultwarden', category: 'applications', version: 'latest',
    description: 'Lightweight Bitwarden-compatible password manager server.',
    iconName: 'ShieldCheck', publisher: 'vaultwarden', official: false, tags: ['security', 'passwords'],
    image: 'vaultwarden/server:latest', defaultPorts: [80],
  },
  {
    id: 'jellyfin', name: 'Jellyfin', category: 'applications', version: 'latest',
    description: 'Free software media system for streaming your own library.',
    iconName: 'Play', publisher: 'jellyfin', official: false, tags: ['media', 'streaming'],
    image: 'jellyfin/jellyfin:latest', defaultPorts: [8096],
  },
  {
    id: 'n8n', name: 'n8n', category: 'applications', version: 'latest',
    description: 'Workflow automation with a visual node editor.',
    iconName: 'Workflow', publisher: 'n8nio', official: false, tags: ['automation', 'workflow'],
    image: 'n8nio/n8n:latest', defaultPorts: [5678],
  },
  {
    id: 'wordpress', name: 'WordPress', category: 'applications', version: '6-apache',
    description: 'The most widely deployed content management system.',
    iconName: 'Globe', publisher: 'wordpress', official: true, tags: ['cms', 'web'],
    image: 'wordpress:6-apache', defaultPorts: [80],
  },
  {
    id: 'ghost', name: 'Ghost', category: 'applications', version: '5-alpine',
    description: 'Publishing platform for blogs and newsletters.',
    iconName: 'Globe', publisher: 'ghost', official: true, tags: ['cms', 'blog'],
    image: 'ghost:5-alpine', defaultPorts: [2368],
  },
  {
    id: 'nocodb', name: 'NocoDB', category: 'applications', version: 'latest',
    description: 'Turns any database into a smart spreadsheet UI.',
    iconName: 'Table', publisher: 'nocodb', official: false, tags: ['database', 'nocode'],
    image: 'nocodb/nocodb:latest', defaultPorts: [8080],
  },
  {
    id: 'minio', name: 'MinIO', category: 'applications', version: 'latest',
    description: 'S3-compatible high performance object storage.',
    iconName: 'HardDrive', publisher: 'minio', official: false, tags: ['storage', 's3'],
    image: 'minio/minio:latest', defaultPorts: [9000, 9001],
  },
  {
    id: 'filebrowser', name: 'File Browser', category: 'applications', version: 'latest',
    description: 'Web file manager for a directory on the host.',
    iconName: 'Folder', publisher: 'filebrowser', official: false, tags: ['files', 'storage'],
    image: 'filebrowser/filebrowser:latest', defaultPorts: [80],
  },
  {
    id: 'adminer', name: 'Adminer', category: 'applications', version: '4',
    description: 'Single-file database management in one PHP file.',
    iconName: 'Database', publisher: 'adminer', official: true, tags: ['database', 'admin'],
    image: 'adminer:4', defaultPorts: [8080],
  },
  {
    id: 'phpmyadmin', name: 'phpMyAdmin', category: 'applications', version: '5',
    description: 'Web administration for MySQL and MariaDB.',
    iconName: 'Database', publisher: 'phpmyadmin', official: true, tags: ['database', 'admin'],
    image: 'phpmyadmin:5', defaultPorts: [80],
  },
  {
    id: 'syncthing', name: 'Syncthing', category: 'applications', version: 'latest',
    description: 'Continuous peer-to-peer file synchronisation.',
    iconName: 'RefreshCw', publisher: 'syncthing', official: false, tags: ['files', 'sync'],
    image: 'syncthing/syncthing:latest', defaultPorts: [8384, 22000],
  },
  {
    id: 'nginx-proxy-manager', name: 'Nginx Proxy Manager', category: 'applications', version: '2',
    description: 'Reverse proxy with a UI and automatic Let\'s Encrypt certificates.',
    iconName: 'Globe', publisher: 'jc21', official: false, tags: ['proxy', 'tls'],
    image: 'jc21/nginx-proxy-manager:2', defaultPorts: [80, 443, 81],
  },
  {
    id: 'pihole', name: 'Pi-hole', category: 'applications', version: 'latest',
    description: 'Network-wide DNS ad blocking.',
    iconName: 'ShieldCheck', publisher: 'pihole', official: false, tags: ['dns', 'network'],
    image: 'pihole/pihole:latest', defaultPorts: [53, 80],
  },
  {
    id: 'adguardhome', name: 'AdGuard Home', category: 'applications', version: 'latest',
    description: 'Network-wide DNS filtering and ad blocking.',
    iconName: 'ShieldCheck', publisher: 'adguard', official: false, tags: ['dns', 'network'],
    image: 'adguard/adguardhome:latest', defaultPorts: [53, 3000],
  },
  {
    id: 'freshrss', name: 'FreshRSS', category: 'applications', version: 'latest',
    description: 'Self-hosted RSS and Atom feed aggregator.',
    iconName: 'Rss', publisher: 'freshrss', official: false, tags: ['rss', 'news'],
    image: 'freshrss/freshrss:latest', defaultPorts: [80],
  },
  {
    id: 'navidrome', name: 'Navidrome', category: 'applications', version: 'latest',
    description: 'Subsonic-compatible music streaming server.',
    iconName: 'Music', publisher: 'deluan', official: false, tags: ['media', 'music'],
    image: 'deluan/navidrome:latest', defaultPorts: [4533],
  },
  {
    id: 'mattermost', name: 'Mattermost', category: 'applications', version: 'release-9',
    description: 'Self-hosted team messaging and collaboration.',
    iconName: 'MessageSquare', publisher: 'mattermost', official: false, tags: ['chat', 'collaboration'],
    image: 'mattermost/mattermost-team-edition:release-9', defaultPorts: [8065],
  },
  {
    id: 'metabase', name: 'Metabase', category: 'applications', version: 'latest',
    description: 'Business intelligence and dashboards over your database.',
    iconName: 'BarChart3', publisher: 'metabase', official: false, tags: ['analytics', 'bi'],
    image: 'metabase/metabase:latest', defaultPorts: [3000],
  },
  {
    id: 'ollama', name: 'Ollama', category: 'applications', version: 'latest',
    description: 'Run large language models locally with a REST API.',
    iconName: 'Cpu', publisher: 'ollama', official: false, tags: ['ai', 'llm'],
    image: 'ollama/ollama:latest', defaultPorts: [11434],
  },
  {
    id: 'netdata', name: 'Netdata', category: 'applications', version: 'latest',
    description: 'Real-time per-second infrastructure monitoring.',
    iconName: 'Activity', publisher: 'netdata', official: false, tags: ['monitoring', 'metrics'],
    image: 'netdata/netdata:latest', defaultPorts: [19999],
  },
  {
    id: 'meilisearch', name: 'Meilisearch', category: 'applications', version: 'v1.8',
    description: 'Fast, typo-tolerant full-text search engine.',
    iconName: 'Search', publisher: 'getmeili', official: false, tags: ['search'],
    image: 'getmeili/meilisearch:v1.8', defaultPorts: [7700],
  },
  {
    id: 'homeassistant', name: 'Home Assistant', category: 'applications', version: 'stable',
    description: 'Open source home automation hub.',
    iconName: 'Cpu', publisher: 'home-assistant', official: false, tags: ['automation', 'iot'],
    image: 'ghcr.io/home-assistant/home-assistant:stable', defaultPorts: [8123],
  },
  {
    id: 'paperless-ngx', name: 'Paperless-ngx', category: 'applications', version: 'latest',
    description: 'Scan, index and archive your documents.',
    iconName: 'FileText', publisher: 'paperless-ngx', official: false, tags: ['documents', 'archive'],
    image: 'ghcr.io/paperless-ngx/paperless-ngx:latest', defaultPorts: [8000],
  },
  {
    id: 'immich', name: 'Immich', category: 'applications', version: 'release',
    description: 'Self-hosted photo and video backup for mobile.',
    iconName: 'Image', publisher: 'immich-app', official: false, tags: ['media', 'photos'],
    image: 'ghcr.io/immich-app/immich-server:release', defaultPorts: [2283],
  },
  {
    id: 'umami', name: 'Umami', category: 'applications', version: 'postgresql-latest',
    description: 'Privacy-focused, cookie-free web analytics.',
    iconName: 'BarChart3', publisher: 'umami-software', official: false, tags: ['analytics', 'privacy'],
    image: 'ghcr.io/umami-software/umami:postgresql-latest', defaultPorts: [3000],
  },
  {
    id: 'open-webui', name: 'Open WebUI', category: 'applications', version: 'main',
    description: 'Browser front-end for Ollama and OpenAI-compatible APIs.',
    iconName: 'MessageSquare', publisher: 'open-webui', official: false, tags: ['ai', 'llm'],
    image: 'ghcr.io/open-webui/open-webui:main', defaultPorts: [8080],
  },
  {
    id: 'code-server', name: 'code-server', category: 'applications', version: 'latest',
    description: 'VS Code running in the browser on your own host.',
    iconName: 'Code', publisher: 'linuxserver', official: false, tags: ['development', 'ide'],
    image: 'lscr.io/linuxserver/code-server:latest', defaultPorts: [8443],
  },
  {
    id: 'bookstack', name: 'BookStack', category: 'applications', version: 'latest',
    description: 'Simple, self-hosted platform for organising documentation.',
    iconName: 'BookOpen', publisher: 'linuxserver', official: false, tags: ['wiki', 'docs'],
    image: 'lscr.io/linuxserver/bookstack:latest', defaultPorts: [80],
  },
  {
    id: 'stack-lemp', name: 'LEMP Stack', category: 'stacks', version: 'nginx + php-fpm + mariadb',
    description: 'Nginx, PHP-FPM and MariaDB wired together for classic PHP hosting.',
    iconName: 'Layers', publisher: 'vpsgui', official: false, tags: ['web', 'php', 'stack'],
    installCommand: 'docker network create lemp && docker run -d --name lemp-db --network lemp -e MARIADB_ROOT_PASSWORD=change-me mariadb:11 && docker run -d --name lemp-web --network lemp -p 80:80 nginx:stable-alpine',
  },
  {
    id: 'stack-monitoring', name: 'Monitoring Stack', category: 'stacks', version: 'prometheus + grafana',
    description: 'Prometheus scraping metrics with Grafana for dashboards.',
    iconName: 'BarChart3', publisher: 'vpsgui', official: false, tags: ['monitoring', 'metrics', 'stack'],
    installCommand: 'docker network create monitoring && docker run -d --name prometheus --network monitoring -p 9090:9090 prom/prometheus:latest && docker run -d --name grafana --network monitoring -p 3000:3000 grafana/grafana:latest',
  },
  {
    id: 'stack-wordpress', name: 'WordPress Stack', category: 'stacks', version: 'wordpress + mariadb',
    description: 'WordPress with its own MariaDB database on a private network.',
    iconName: 'Globe', publisher: 'vpsgui', official: false, tags: ['cms', 'web', 'stack'],
    installCommand: 'docker network create wp && docker run -d --name wp-db --network wp -e MARIADB_ROOT_PASSWORD=change-me -e MARIADB_DATABASE=wordpress mariadb:11 && docker run -d --name wordpress --network wp -p 80:80 -e WORDPRESS_DB_HOST=wp-db wordpress:6-apache',
  },
  {
    id: 'stack-elk-lite', name: 'Logging Stack', category: 'stacks', version: 'loki + grafana',
    description: 'Grafana Loki for log aggregation with Grafana to query it.',
    iconName: 'FileText', publisher: 'vpsgui', official: false, tags: ['logging', 'observability', 'stack'],
    installCommand: 'docker network create logging && docker run -d --name loki --network logging -p 3100:3100 grafana/loki:2.9.8 && docker run -d --name grafana-logs --network logging -p 3000:3000 grafana/grafana:latest',
  },
  {
    id: 'stack-ai-local', name: 'Local AI Stack', category: 'stacks', version: 'ollama + open-webui',
    description: 'Ollama serving local models behind the Open WebUI chat front-end.',
    iconName: 'Cpu', publisher: 'vpsgui', official: false, tags: ['ai', 'llm', 'stack'],
    installCommand: 'docker network create ai && docker run -d --name ollama --network ai -p 11434:11434 ollama/ollama:latest && docker run -d --name open-webui --network ai -p 8080:8080 -e OLLAMA_BASE_URL=http://ollama:11434 ghcr.io/open-webui/open-webui:main',
  },
  {
    id: 'os-ubuntu-2404', name: 'Ubuntu Server 24.04 LTS', category: 'operating_systems', version: 'noble',
    description: 'Cloud image for the current Ubuntu LTS release.',
    iconName: 'HardDrive', publisher: 'Canonical', official: true, tags: ['linux', 'debian-family', 'lts'],
    installCommand: 'curl -fsSLO https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img',
  },
  {
    id: 'os-ubuntu-2204', name: 'Ubuntu Server 22.04 LTS', category: 'operating_systems', version: 'jammy',
    description: 'Cloud image for the previous Ubuntu LTS release.',
    iconName: 'HardDrive', publisher: 'Canonical', official: true, tags: ['linux', 'debian-family', 'lts'],
    installCommand: 'curl -fsSLO https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img',
  },
  {
    id: 'os-debian-12', name: 'Debian 12 (Bookworm)', category: 'operating_systems', version: 'bookworm',
    description: 'Generic cloud image for Debian stable.',
    iconName: 'HardDrive', publisher: 'Debian', official: true, tags: ['linux', 'debian-family', 'stable'],
    installCommand: 'curl -fsSLO https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-genericcloud-amd64.qcow2',
  },
  {
    id: 'os-almalinux-9', name: 'AlmaLinux 9', category: 'operating_systems', version: '9',
    description: 'RHEL-compatible generic cloud image.',
    iconName: 'HardDrive', publisher: 'AlmaLinux', official: true, tags: ['linux', 'rhel-family'],
    installCommand: 'curl -fsSLO https://repo.almalinux.org/almalinux/9/cloud/x86_64/images/AlmaLinux-9-GenericCloud-latest.x86_64.qcow2',
  },
  {
    id: 'os-rocky-9', name: 'Rocky Linux 9', category: 'operating_systems', version: '9',
    description: 'RHEL-compatible generic cloud image.',
    iconName: 'HardDrive', publisher: 'Rocky Enterprise Software Foundation', official: true, tags: ['linux', 'rhel-family'],
    installCommand: 'curl -fsSLO https://dl.rockylinux.org/pub/rocky/9/images/x86_64/Rocky-9-GenericCloud.latest.x86_64.qcow2',
  },
  {
    id: 'vm-openwrt', name: 'OpenWrt', category: 'vm_images', version: '23.05',
    description: 'Linux distribution for routers, as an x86-64 disk image.',
    iconName: 'Radio', publisher: 'OpenWrt', official: true, tags: ['network', 'router', 'appliance'],
    installCommand: 'curl -fsSLO https://downloads.openwrt.org/releases/23.05.5/targets/x86/64/openwrt-23.05.5-x86-64-generic-ext4-combined.img.gz',
  },
  {
    id: 'vm-alpine-virt', name: 'Alpine Linux (virt)', category: 'vm_images', version: '3.20',
    description: 'Minimal Alpine image tuned for virtual machines.',
    iconName: 'HardDrive', publisher: 'Alpine Linux', official: true, tags: ['linux', 'minimal', 'appliance'],
    installCommand: 'curl -fsSLO https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/x86_64/alpine-virt-3.20.3-x86_64.iso',
  },
].map((item) => ({
  // Download counts and star ratings would have to come from a registry the agent does not
  // query; omitting them beats printing an invented "4.8 / 12k downloads".
  downloadsCount: null,
  rating: null,
  ...item,
}));

/**
 * Features that need persistent state or an orchestration backend the agent does not have.
 *
 * They return an empty list with 200 rather than 404 so the UI renders a clean, explained empty
 * state instead of spraying console errors on every page load. `/agent/info` advertises them as
 * unsupported so the frontend can say why.
 */
const UNIMPLEMENTED_FEATURES = [];

// ---------------------------------------------------------------------------
// Users, audit log, health matrix, topology, timers, cron
// ---------------------------------------------------------------------------

/** Shells that mean the account cannot log in interactively. */
const NOLOGIN_SHELLS = new Set(['/usr/sbin/nologin', '/sbin/nologin', '/bin/false', '/usr/bin/false']);

/** Real host accounts from /etc/passwd, enriched with group membership and last login. */
async function getSystemUsers()
{
  if (os.platform() !== 'linux') return [];

  let passwd;
  try {
    passwd = await fsp.readFile('/etc/passwd', 'utf-8');
  } catch (e) {
    return [];
  }

  // Supplementary group memberships from /etc/group.
  const groupsByUser = Object.create(null);
  try {
    const groupFile = await fsp.readFile('/etc/group', 'utf-8');
    for (const line of groupFile.split('\n')) {
      const [groupName, , , members] = line.split(':');
      if (!groupName || !members) continue;
      for (const member of members.split(',').filter(Boolean)) {
        (groupsByUser[member] ??= []).push(groupName);
      }
    }
  } catch (e) {
    /* /etc/group unreadable */
  }

  // `lastlog` reports the most recent login for every account in a single call.
  const lastLoginByUser = Object.create(null);
  const lastlogOut = await tryRun('lastlog', [], { timeout: 8000 });
  if (lastlogOut) {
    for (const line of lastlogOut.split('\n').slice(1)) {
      const name = line.split(/\s+/)[0];
      if (!name) continue;
      lastLoginByUser[name] = /Never logged in/.test(line)
        ? null
        : line.slice(name.length).trim().replace(/\s+/g, ' ');
    }
  }

  return passwd
    .split('\n')
    .filter(Boolean)
    .map((line) =>
    {
      const [username, , uidRaw, gidRaw, gecos, home, shell] = line.split(':');
      const uid = Number.parseInt(uidRaw, 10);
      if (!username || !Number.isFinite(uid)) return null;
      return {
        id: `user-${uid}`,
        username,
        uid,
        gid: Number.parseInt(gidRaw, 10) || 0,
        // The GECOS field's first comma-separated part is the human name, when it is set at all.
        fullName: (gecos || '').split(',')[0] || '',
        home: home || '',
        shell: shell || '',
        // Accounts below UID 1000 are service accounts rather than people.
        isSystem: uid < 1000 && uid !== 0,
        canLogin: !NOLOGIN_SHELLS.has(shell || ''),
        groups: groupsByUser[username] || [],
        lastLogin: lastLoginByUser[username] ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.uid - b.uid);
}

/**
 * Authentication events from the systemd journal.
 *
 * A real audit trail of SSH and sudo activity. The agent keeps no action history of its own, so
 * this reports what the host actually recorded rather than inventing application-level events.
 */
async function getAuditLogs()
{
  if (os.platform() !== 'linux') return [];

  const output = await tryRun(
    'journalctl',
    ['--no-pager', '-n', '300', '-o', 'short-iso', '-t', 'sshd', '-t', 'sudo'],
    { timeout: 10000 }
  );
  if (!output) return [];

  const events = [];
  for (const line of output.split('\n').filter(Boolean)) {
    const tsMatch = /^(\S+)/.exec(line);
    if (!tsMatch) continue;
    const timestamp = new Date(tsMatch[1]);
    if (Number.isNaN(timestamp.getTime())) continue;

    const ip = (/from ([0-9a-fA-F:.]+)/.exec(line) || [])[1] || '';
    let action = null;
    let status = 'success';
    let user = '';
    let m;

    if ((m = /Accepted (?:password|publickey|keyboard-interactive\/pam) for (\S+)/.exec(line))) {
      action = 'SSH login accepted';
      user = m[1];
    } else if ((m = /Failed (?:password|publickey) for (?:invalid user )?(\S+)/.exec(line))) {
      action = 'SSH login failed';
      status = 'failure';
      user = m[1];
    } else if ((m = /Invalid user (\S+)/.exec(line))) {
      action = 'SSH login attempt for unknown user';
      status = 'failure';
      user = m[1];
    } else if ((m = /session opened for user (\S+)/.exec(line))) {
      action = 'Session opened';
      user = m[1];
    } else if ((m = /(\S+) : TTY=\S+ ; PWD=\S+ ; USER=(\S+) ; COMMAND=(.+)$/.exec(line))) {
      action = `sudo: ${m[3]}`;
      user = m[1];
    } else {
      continue;
    }

    events.push({
      id: `audit-${events.length}-${timestamp.getTime()}`,
      timestamp: timestamp.toISOString(),
      // The host log knows a username; it has no source for a display name, email or avatar.
      actor: { name: user || 'unknown', email: '', avatarUrl: '' },
      action,
      category: 'auth',
      target: os.hostname(),
      ipAddress: ip,
      status,
      details: line.length > 300 ? `${line.slice(0, 300)}...` : line,
    });
  }

  return events.reverse();
}

/** Live health checks computed from real host state. No check reports a status it did not measure. */
async function getHealthMatrix()
{
  const now = new Date().toISOString();
  const checks = [];
  const telemetry = await getRealTelemetry();

  const push = (id, category, name, target, status, message, latencyMs = 0) =>
    checks.push({ id, category, name, target, status, latencyMs, message, lastCheck: now });

  push('health-agent', 'node', 'Agent', `${HOST}:${PORT}`, 'green', `vpsgui-agent v${AGENT_VERSION} responding`);

  const mem = telemetry.ramPercent;
  push(
    'health-memory', 'node', 'Memory', os.hostname(),
    mem >= 95 ? 'red' : mem >= 85 ? 'yellow' : 'green',
    `${mem}% of ${Math.round(telemetry.memoryTotalBytes / 1073741824)} GB in use`
  );

  if (telemetry.diskTotalBytes > 0) {
    const disk = telemetry.diskPercent;
    push(
      'health-disk', 'node', 'Root filesystem', '/',
      disk >= 95 ? 'red' : disk >= 85 ? 'yellow' : 'green',
      `${disk}% of ${Math.round(telemetry.diskTotalBytes / 1073741824)} GB used`
    );
  }

  const cores = telemetry.cpuCores || 1;
  const load1 = (telemetry.loadAverage && telemetry.loadAverage[0]) || 0;
  const loadRatio = load1 / cores;
  push(
    'health-load', 'node', 'CPU load', os.hostname(),
    loadRatio >= 2 ? 'red' : loadRatio >= 1 ? 'yellow' : 'green',
    `1-minute load ${load1.toFixed(2)} across ${cores} cores`
  );

  if (os.platform() === 'linux') {
    const failed = await tryRun('systemctl', ['list-units', '--state=failed', '--no-legend', '--no-pager', '--plain'], { timeout: 8000 });
    const failedUnits = (failed || '').trim().split('\n').filter(Boolean);
    push(
      'health-systemd', 'service', 'systemd units', os.hostname(),
      failedUnits.length > 0 ? 'red' : 'green',
      failedUnits.length > 0 ? `${failedUnits.length} failed unit(s)` : 'No failed units'
    );
  }

  const dockerVersion = await tryRun('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 8000 });
  if (dockerVersion) {
    const containers = await getRealDockerContainers();
    const running = containers.filter((c) => c.state === 'running').length;
    push(
      'health-docker', 'container', 'Docker engine', os.hostname(), 'green',
      `Engine ${dockerVersion.trim()} - ${running}/${containers.length} containers running`
    );
  }

  return checks;
}

/**
 * Infrastructure topology derived from what the host actually runs: the node itself, its Docker
 * containers, and the database engines detected on listening ports.
 */
async function getTopology()
{
  const [containers, databases, telemetry] = await Promise.all([
    getRealDockerContainers(),
    getDatabases(),
    getRealTelemetry(),
  ]);

  const layers = [
    {
      level: 'Edge',
      items: [{ id: 'internet', title: 'Internet', type: 'cloud', status: 'online', desc: 'Inbound traffic' }],
    },
    {
      level: 'Host',
      items: [
        {
          id: 'host',
          title: os.hostname(),
          type: 'vps',
          status: 'online',
          desc: `${telemetry.cpuCores} vCPU · ${Math.round(telemetry.memoryTotalBytes / 1073741824)} GB RAM · ${telemetry.osName}`,
        },
      ],
    },
  ];

  if (containers.length > 0) {
    layers.push({
      level: 'Containers',
      items: containers.map((c) => ({
        id: `container-${c.id}`,
        title: c.name,
        type: 'docker',
        status: c.state === 'running' ? 'online' : 'offline',
        desc: c.image,
      })),
    });
  }

  if (databases.length > 0) {
    layers.push({
      level: 'Data',
      items: databases.map((db) => ({
        id: `db-${db.port}`,
        title: db.engine,
        type: 'database',
        status: 'online',
        desc: `Listening on port ${db.port}`,
      })),
    });
  }

  return layers;
}

/**
 * Detail for one topology node.
 *
 * The map used to call an endpoint that did not exist, take the 404, and fill
 * the panel from whatever the browser already had - including a hardcoded
 * "Active 100%" routing figure and a "Security Inspection" line reading
 * "Agent Reported" when no agent had reported anything.
 *
 * Every field here is measured or null. Null renders as "--", which is the
 * honest answer for latency on a node there is nothing to ping.
 */
async function getTopologyNodeDetail(nodeId)
{
  const id = String(nodeId || '').trim();
  if (!id) return null;

  /** ufw is the only firewall the agent reads, so it is the only one claimed. */
  const describeFirewall = async () =>
  {
    if (os.platform() !== 'linux') return null;
    const output = await tryRun('ufw', ['status'], { timeout: 8000 });
    if (!output) return 'ufw not available';
    if (/^Status:\s*active/im.test(output)) {
      const rules = await getFirewallRules();
      return `ufw active, ${rules.length} rule${rules.length === 1 ? '' : 's'}`;
    }
    return 'ufw installed but inactive';
  };

  if (id === 'internet') {
    return {
      id,
      kind: 'edge',
      routing: 'Inbound',
      // Nothing to measure: this node is a label for "everything outside".
      latency: null,
      throughput: null,
      security: await describeFirewall(),
      detail: { publicIp: await resolvePublicIp() },
    };
  }

  if (id === 'host') {
    const telemetry = await getRealTelemetry();
    const interfaces = getNetworkInterfaces();

    return {
      id,
      kind: 'host',
      routing: 'Active',
      // Latency needs a target. The agent is not going to invent one.
      latency: null,
      // netRxKbps/netTxKbps are sampled rates, so this really is throughput
      // rather than a cumulative counter relabelled as one.
      throughput: `${telemetry.netRxKbps} kbps in / ${telemetry.netTxKbps} kbps out`,
      security: await describeFirewall(),
      detail: {
        hostname: telemetry.hostname,
        uptimeSeconds: telemetry.uptimeSeconds,
        cpuCores: telemetry.cpuCores,
        loadAverage: telemetry.loadAverage,
        interfaces: interfaces.map((i) => ({ name: i.name, ipv4: i.ipv4 })),
      },
    };
  }

  if (id.startsWith('container-')) {
    const containerId = id.slice('container-'.length);
    const containers = await getRealDockerContainers();
    const match = containers.find((c) => c.id === containerId || c.name === containerId);
    if (!match) return null;

    return {
      id,
      kind: 'container',
      routing: match.state === 'running' ? 'Running' : match.state || 'Stopped',
      latency: null,
      // Per-container network rates would need `docker stats --no-stream` per
      // container on every poll; cpu and memory are already sampled, so those
      // are what get reported.
      throughput: null,
      security:
        match.ports && match.ports.length
          ? `Published: ${Array.isArray(match.ports) ? match.ports.join(', ') : match.ports}`
          : 'No published ports',
      detail: {
        image: match.image,
        state: match.state,
        status: match.status,
        ports: match.ports,
        cpuPercent: match.cpuPercent ?? null,
        memoryUsageMb: match.memoryUsageMb ?? null,
      },
    };
  }

  if (id.startsWith('db-')) {
    const port = Number.parseInt(id.slice('db-'.length), 10);
    const databases = await getDatabases();
    const match = databases.find((db) => db.port === port);
    if (!match) return null;

    return {
      id,
      kind: 'database',
      routing: `Listening on ${match.port}`,
      latency: null,
      throughput: null,
      // The agent detects the engine by its listening port only. It holds no
      // credentials, so anything about the data itself stays null.
      security: 'Detected by listening port; not authenticated',
      detail: { engine: match.engine, port: match.port, size: null, tables: null, keys: null },
    };
  }

  return null;
}

/** systemd timers - the host's real scheduled-job mechanism. */
async function getQueueJobs()
{
  if (os.platform() !== 'linux') return [];
  const output = await tryRun('systemctl', ['list-timers', '--all', '--no-legend', '--no-pager'], { timeout: 8000 });
  if (!output) return [];

  const jobs = [];
  for (const line of output.trim().split('\n').filter(Boolean)) {
    const cols = line.trim().split(/\s+/);
    const unitIdx = cols.findIndex((c) => c.endsWith('.timer'));
    if (unitIdx === -1) continue;

    const unit = cols[unitIdx];
    const activates = cols[unitIdx + 1] || '';
    const next = cols.slice(0, unitIdx).join(' ');

    jobs.push({
      id: `timer-${unit}`,
      title: activates || unit,
      nodeName: os.hostname(),
      type: 'systemd-timer',
      status: /n\/a/i.test(next) ? 'completed' : 'queued',
      // A timer has no meaningful completion percentage; 0 rather than an invented figure.
      progressPercent: 0,
      startedAt: new Date().toISOString(),
      logs: [`Next elapse: ${next || 'unknown'}`, `Unit: ${unit}`],
    });
  }
  return jobs;
}

/** Cron entries from the system crontab, /etc/cron.d and root's crontab. */
async function getAutomationWorkflows()
{
  if (os.platform() !== 'linux') return [];

  const workflows = [];
  const seen = new Set();

  const addEntry = (source, line) =>
  {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    // Skip environment assignments such as PATH= or SHELL=.
    if (/^[A-Z_]+\s*=/.test(trimmed)) return;

    const fields = trimmed.split(/\s+/);
    if (fields.length < 6) return;

    const schedule = fields.slice(0, 5).join(' ');
    const rest = fields.slice(5);
    // System crontabs carry a user field before the command; a user crontab does not.
    const isSystemTab = source !== 'root crontab';
    const command = (isSystemTab ? rest.slice(1) : rest).join(' ');
    if (!command) return;

    const key = `${schedule} ${command}`;
    if (seen.has(key)) return;
    seen.add(key);

    workflows.push({
      id: `cron-${workflows.length}`,
      name: command.length > 60 ? `${command.slice(0, 60)}...` : command,
      description: `${source} · ${schedule}`,
      status: 'active',
      triggerType: 'cron',
      schedule,
      stepsCount: 1,
      // The full command, so the UI can run it on demand rather than only displaying a truncated name.
      command,
      source,
      // cron keeps no execution history the agent can read, so these stay absent rather than faked.
      steps: [],
    });
  };

  const systemTab = await tryRun('cat', ['/etc/crontab'], { timeout: 5000 });
  if (systemTab) systemTab.split('\n').forEach((l) => addEntry('/etc/crontab', l));

  try {
    for (const entry of await fsp.readdir('/etc/cron.d')) {
      const content = await fsp.readFile(path.join('/etc/cron.d', entry), 'utf-8').catch(() => '');
      content.split('\n').forEach((l) => addEntry(`/etc/cron.d/${entry}`, l));
    }
  } catch (e) {
    /* no /etc/cron.d on this host */
  }

  const rootTab = await tryRun('crontab', ['-l'], { timeout: 5000 });
  if (rootTab) rootTab.split('\n').forEach((l) => addEntry('root crontab', l));

  return workflows;
}

// ---------------------------------------------------------------------------
// Firewall and filesystem mutations
// ---------------------------------------------------------------------------

/** ufw verbs the agent will run. Null-prototype so `constructor` cannot smuggle a value through. */
const UFW_ACTIONS = Object.assign(Object.create(null), { allow: 1, deny: 1, reject: 1, limit: 1, delete: 1 });

/** A single port (22), an inclusive range (6000:6010), or a comma list (80,443). */
const PORT_SPEC = /^\d{1,5}(:\d{1,5})?(,\d{1,5}(:\d{1,5})?)*$/;
/** IPv4/IPv6 address or CIDR, or the literal "any". */
const SOURCE_SPEC = /^(any|[0-9a-fA-F:.]+(\/\d{1,3})?)$/;

/**
 * Build the ufw argument vector for a rule change.
 *
 * Returns { args } or { error }. Every component is validated against a strict pattern and passed
 * as a separate argv entry - nothing is interpolated into a shell string.
 */
function buildUfwArgs({ action, port, protocol, source, ruleNumber })
{
  if (typeof action !== 'string' || !UFW_ACTIONS[action]) {
    return { error: 'Invalid firewall action' };
  }

  if (action === 'delete') {
    // ufw deletes by rule number, which is what `ufw status numbered` reports.
    const num = Number.parseInt(ruleNumber, 10);
    if (!Number.isInteger(num) || num < 1 || num > 1000) {
      return { error: 'delete requires a valid rule number' };
    }
    // --force skips the interactive "Proceed (y|n)?" prompt, which would otherwise hang.
    return { args: ['--force', 'delete', String(num)] };
  }

  if (typeof port !== 'string' || !PORT_SPEC.test(port)) {
    return { error: 'Invalid port specification' };
  }
  for (const p of port.split(/[,:]/)) {
    const n = Number.parseInt(p, 10);
    if (!Number.isInteger(n) || n < 1 || n > 65535) return { error: `Port out of range: ${p}` };
  }

  const proto = typeof protocol === 'string' ? protocol.toLowerCase() : 'tcp';
  if (proto !== 'tcp' && proto !== 'udp' && proto !== 'any') {
    return { error: 'Protocol must be tcp, udp, or any' };
  }

  const src = typeof source === 'string' && source.trim() ? source.trim() : 'any';
  if (!SOURCE_SPEC.test(src)) return { error: 'Invalid source address' };

  // `ufw allow from <src> to any port <port> proto <proto>` is the general form; the short form
  // `ufw allow <port>/<proto>` cannot express a source restriction.
  const args = [action, 'from', src, 'to', 'any', 'port', port];
  if (proto !== 'any') args.push('proto', proto);
  return { args };
}

/** Apply a ufw rule change. */
async function applyFirewallAction(body)
{
  // Validate BEFORE the platform check: a malformed request is a client error on any host,
  // and putting the guard first made every bad payload look like a 200 "not supported".
  const built = buildUfwArgs(body || {});
  if (built.error) return { success: false, output: built.error, invalid: true };

  if (os.platform() !== 'linux') {
    return { success: false, output: 'Firewall management requires a Linux host with ufw.' };
  }
  try {
    const output = await run('ufw', built.args, { timeout: 20000 });
    return { success: true, output: output.trim() || 'Rule applied.' };
  } catch (e) {
    return { success: false, output: execErrorPayload(e) };
  }
}

/**
 * Create a directory inside the configured file roots.
 */
async function createDirectory(targetPath)
{
  const safe = await resolveSafePath(targetPath, { mustExist: false });
  if (safe.error) return { status: safe.status, body: { success: false, error: safe.error, roots: FILE_ROOTS } };

  try {
    await fsp.mkdir(safe.path, { recursive: true, mode: 0o755 });
    return { status: 200, body: { success: true, path: safe.path } };
  } catch (e) {
    return { status: 500, body: { success: false, error: e.message } };
  }
}

/**
 * Delete a file or directory inside the configured file roots.
 *
 * Recursive deletion is opt-in per request so a mis-click on a directory cannot wipe a tree, and
 * the roots themselves are never removable.
 */
async function deletePath(targetPath, recursive)
{
  const safe = await resolveSafePath(targetPath);
  if (safe.error) return { status: safe.status, body: { success: false, error: safe.error, roots: FILE_ROOTS } };

  if (FILE_ROOTS.some((root) => root === safe.path)) {
    return { status: 403, body: { success: false, error: 'Refusing to delete a configured file root' } };
  }

  try {
    const stat = await fsp.lstat(safe.path);
    if (stat.isDirectory()) {
      if (!recursive) {
        // rmdir fails on a non-empty directory, which is the safe default.
        await fsp.rmdir(safe.path);
      } else {
        await fsp.rm(safe.path, { recursive: true, force: false });
      }
    } else {
      await fsp.unlink(safe.path);
    }
    return { status: 200, body: { success: true, path: safe.path } };
  } catch (e) {
    if (e.code === 'ENOTEMPTY') {
      return {
        status: 400,
        body: { success: false, error: 'Directory is not empty. Re-send with recursive: true to delete its contents.' },
      };
    }
    return { status: e.code === 'ENOENT' ? 404 : 500, body: { success: false, error: e.message } };
  }
}

/** Rename or move a path. BOTH endpoints are confined, so a move cannot escape the roots. */
async function renamePath(fromPath, toPath)
{
  const from = await resolveSafePath(fromPath);
  if (from.error) return { status: from.status, body: { success: false, error: from.error, roots: FILE_ROOTS } };

  const to = await resolveSafePath(toPath, { mustExist: false });
  if (to.error) return { status: to.status, body: { success: false, error: to.error, roots: FILE_ROOTS } };

  if (await fsp.stat(to.path).then(() => true).catch(() => false)) {
    // rename() would silently clobber the destination.
    return { status: 409, body: { success: false, error: 'Destination already exists' } };
  }

  try {
    await fsp.rename(from.path, to.path);
    return { status: 200, body: { success: true, from: from.path, to: to.path } };
  } catch (e) {
    return { status: 500, body: { success: false, error: e.message } };
  }
}

// ---------------------------------------------------------------------------
// Git deployments, archive backups, encrypted secrets
// ---------------------------------------------------------------------------

// Where to look for git checkouts. Scanning every file root recursively would be far too slow, so
// this is a small, explicit list walked to a shallow depth.
const DEPLOY_ROOTS = (process.env.AGENT_DEPLOY_ROOTS
  ? process.env.AGENT_DEPLOY_ROOTS.split(',').map((p) => p.trim()).filter(Boolean)
  : ['/var/www', '/opt', '/srv', '/home']
).map((p) => path.resolve(p));

const DEPLOY_SCAN_DEPTH = 3;

/** Directories that never contain a deployment and would dominate the scan. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', 'build', '.cache', 'tmp', 'proc', 'sys']);

/** Find git checkouts under DEPLOY_ROOTS, breadth-limited so the scan stays fast. */
async function findGitRepos()
{
  const found = [];
  const seen = new Set();

  async function walk(dir, depth)
  {
    if (depth > DEPLOY_SCAN_DEPTH || found.length >= 50) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    if (entries.some((e) => e.isDirectory() && e.name === '.git')) {
      if (!seen.has(dir)) {
        seen.add(dir);
        found.push(dir);
      }
      // A repository's subdirectories are part of that checkout, not separate deployments.
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }

  for (const root of DEPLOY_ROOTS) await walk(root, 0);
  // readdir order is filesystem-defined (ext4 returns hash order, not alphabetical) and can change
  // as directories are written to. Sorting makes the reported order stable, so the cards do not
  // reshuffle between one scan and the next.
  return found.sort();
}

/**
 * A stable identifier for a checkout.
 *
 * This used to be `repo-${index}` - the position in the scan array. Because the scan order is not
 * guaranteed, the same id could refer to a different repository on the next scan, and the UI keys
 * a pull's output by it: the result of pulling one checkout could be rendered under another. The
 * path is the one thing that actually identifies a checkout, so the id is derived from it. The
 * readable slug keeps it debuggable; the hash suffix keeps two paths that slugify alike apart.
 */
function deploymentId(repoPath)
{
  const slug = String(repoPath).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const digest = crypto.createHash('sha1').update(String(repoPath)).digest('hex').slice(0, 8);
  return `repo-${slug.slice(0, 48)}-${digest}`;
}

/**
 * Git checkouts on the host, reported as deployments.
 *
 * There is no build pipeline to invent a history from, so this describes what is actually deployed
 * right now: the commit each checkout is on, whether it has local modifications, and how far it has
 * drifted from its remote.
 */
async function getDeployments()
{
  if (os.platform() === 'win32') return [];
  const repos = await findGitRepos();

  return Promise.all(
    repos.map(async (repo) =>
    {
      const git = (args) => tryRun('git', ['-C', repo, ...args], { timeout: 8000 });

      const [branch, sha, subject, when, remote, status, tracking] = await Promise.all([
        git(['rev-parse', '--abbrev-ref', 'HEAD']),
        git(['rev-parse', '--short', 'HEAD']),
        git(['log', '-1', '--pretty=%s']),
        git(['log', '-1', '--pretty=%cI']),
        git(['config', '--get', 'remote.origin.url']),
        git(['status', '--porcelain']),
        git(['rev-list', '--left-right', '--count', 'HEAD...@{u}']),
      ]);

      const dirtyCount = (status || '').trim() ? (status || '').trim().split('\n').length : 0;
      // `rev-list --left-right --count HEAD...@{u}` prints "<ahead>\t<behind>".
      const [aheadRaw, behindRaw] = (tracking || '').trim().split(/\s+/);
      const ahead = Number.parseInt(aheadRaw, 10) || 0;
      const behind = Number.parseInt(behindRaw, 10) || 0;

      return {
        id: deploymentId(repo),
        path: repo,
        app: path.basename(repo),
        branch: (branch || '').trim() || 'unknown',
        commit: (sha || '').trim() || 'unknown',
        message: (subject || '').trim(),
        // ISO-8601 from git; null when the repo has no commits yet.
        committedAt: (when || '').trim() || null,
        remote: (remote || '').trim(),
        dirtyCount,
        ahead,
        behind,
        // Derived purely from measured state - nothing here is a placeholder.
        status: dirtyCount > 0 ? 'modified' : behind > 0 ? 'behind' : 'clean',
      };
    })
  );
}

/** `git pull --ff-only` in a checkout, refusing anything that would need a merge commit. */
async function pullDeployment(repoPath)
{
  if (typeof repoPath !== 'string' || !repoPath.trim()) {
    return { status: 400, body: { success: false, output: 'A repository path is required' } };
  }

  const resolved = path.resolve(repoPath);
  const known = await findGitRepos();
  // Only repositories the scan already reported may be pulled, so an arbitrary path cannot be
  // handed to git.
  if (!known.includes(resolved)) {
    return { status: 403, body: { success: false, output: 'Not a known deployment path' } };
  }

  try {
    const output = await run('git', ['-C', resolved, 'pull', '--ff-only'], { timeout: 120000 });
    return { status: 200, body: { success: true, output: output.trim() || 'Already up to date.' } };
  } catch (e) {
    return { status: 200, body: { success: false, output: execErrorPayload(e) } };
  }
}

// ---------------------------------------------------------------------------

const BACKUP_DIR = path.resolve(process.env.AGENT_BACKUP_DIR || '/var/backups/vpsgui');
const ARCHIVE_SUFFIX = '.tar.gz';
/** Archive names are generated from this pattern; anything else is rejected. */
const ARCHIVE_NAME = /^[a-zA-Z0-9._-]{1,120}$/;

/** tar.gz archives previously created by this agent. */
async function getBackups()
{
  if (os.platform() === 'win32') return [];

  let entries;
  try {
    entries = await fsp.readdir(BACKUP_DIR, { withFileTypes: true });
  } catch (e) {
    // The directory is created on first backup; absent simply means none have been taken.
    return [];
  }

  const backups = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(ARCHIVE_SUFFIX)) continue;
    const full = path.join(BACKUP_DIR, entry.name);
    let stat;
    try {
      stat = await fsp.stat(full);
    } catch (e) {
      continue;
    }
    backups.push({
      id: entry.name,
      name: entry.name,
      path: full,
      sizeBytes: stat.size,
      size: `${Math.round((stat.size / 1048576) * 10) / 10} MB`,
      target: BACKUP_DIR,
      date: stat.mtime.toISOString(),
      status: 'complete',
    });
  }

  return backups.sort((a, b) => b.date.localeCompare(a.date));
}

/** Create a tar.gz of a directory inside the agent's file roots. */
async function createBackup(sourcePath, label)
{
  // Confine the source BEFORE the platform check, so an escape attempt is a 403 on any host rather
  // than being masked by a "not supported here" 400.
  const safe = await resolveSafePath(sourcePath);
  if (safe.error) return { status: safe.status, body: { success: false, error: safe.error, roots: FILE_ROOTS } };

  if (os.platform() === 'win32') {
    return { status: 400, body: { success: false, error: 'Backups require a Linux host with tar.' } };
  }

  const stat = await fsp.stat(safe.path).catch(() => null);
  if (!stat) return { status: 404, body: { success: false, error: 'Source path not found' } };

  const slug = (label && String(label).trim()) || path.basename(safe.path) || 'backup';
  const safeSlug = slug.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 60);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `${safeSlug}-${stamp}${ARCHIVE_SUFFIX}`;
  if (!ARCHIVE_NAME.test(name)) {
    return { status: 400, body: { success: false, error: 'Could not derive a valid archive name' } };
  }

  try {
    await fsp.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
    // -C <parent> <basename> keeps the archive relative, so it does not unpack absolute paths.
    await run(
      'tar',
      ['czf', path.join(BACKUP_DIR, name), '-C', path.dirname(safe.path), path.basename(safe.path)],
      { timeout: 600000, maxBuffer: 8 * 1024 * 1024 }
    );
    return { status: 200, body: { success: true, name, path: path.join(BACKUP_DIR, name) } };
  } catch (e) {
    return { status: 200, body: { success: false, error: execErrorPayload(e) } };
  }
}

/** Delete an archive from the backup directory. */
async function deleteBackup(name)
{
  if (typeof name !== 'string' || !ARCHIVE_NAME.test(name) || !name.endsWith(ARCHIVE_SUFFIX)) {
    return { status: 400, body: { success: false, error: 'Invalid archive name' } };
  }
  // The name pattern excludes path separators, so this cannot escape BACKUP_DIR.
  try {
    await fsp.unlink(path.join(BACKUP_DIR, name));
    return { status: 200, body: { success: true } };
  } catch (e) {
    return { status: e.code === 'ENOENT' ? 404 : 500, body: { success: false, error: e.message } };
  }
}

/** Extract an archive back over a destination inside the file roots. */
async function restoreBackup(name, destination)
{
  if (typeof name !== 'string' || !ARCHIVE_NAME.test(name) || !name.endsWith(ARCHIVE_SUFFIX)) {
    return { status: 400, body: { success: false, error: 'Invalid archive name' } };
  }

  const safe = await resolveSafePath(destination);
  if (safe.error) return { status: safe.status, body: { success: false, error: safe.error, roots: FILE_ROOTS } };

  const archive = path.join(BACKUP_DIR, name);
  if (!(await fsp.stat(archive).catch(() => null))) {
    return { status: 404, body: { success: false, error: 'Archive not found' } };
  }

  try {
    await run('tar', ['xzf', archive, '-C', safe.path], { timeout: 600000 });
    return { status: 200, body: { success: true, restoredTo: safe.path } };
  } catch (e) {
    return { status: 200, body: { success: false, error: execErrorPayload(e) } };
  }
}

// ---------------------------------------------------------------------------

const SECRETS_FILE = path.join(__dirname, '.secrets.json');
const SECRETS_KEY_FILE = path.join(__dirname, '.secrets-key');
const SECRET_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,64}$/;

/**
 * Load (or create) the AES key used to encrypt secret values.
 *
 * IMPORTANT - what this does and does not protect against. Values are encrypted at rest with
 * AES-256-GCM, so they do not appear in plaintext in the store, in backups of it, or in anything
 * that happens to read the file. It does NOT protect against root on this host: the agent runs as
 * root and must be able to decrypt, so the key sits beside the data. Use a dedicated secret manager
 * if you need protection from a compromised host.
 */
async function getSecretsKey()
{
  try {
    const existing = await fsp.readFile(SECRETS_KEY_FILE, 'utf-8');
    const buf = Buffer.from(existing.trim(), 'hex');
    if (buf.length === 32) return buf;
  } catch (e) {
    /* generate below */
  }
  const key = crypto.randomBytes(32);
  await fsp.writeFile(SECRETS_KEY_FILE, key.toString('hex'), { mode: 0o600 });
  await fsp.chmod(SECRETS_KEY_FILE, 0o600).catch(() => { });
  return key;
}

async function readSecretStore()
{
  try {
    const raw = await fsp.readFile(SECRETS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

async function writeSecretStore(entries)
{
  await fsp.writeFile(SECRETS_FILE, JSON.stringify(entries, null, 2), { mode: 0o600 });
  await fsp.chmod(SECRETS_FILE, 0o600).catch(() => { });
}

function encryptValue(key, plaintext)
{
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: enc.toString('base64'),
  };
}

function decryptValue(key, record)
{
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.data, 'base64')), decipher.final()]).toString('utf-8');
}

/** Secret metadata. Values are never included - reveal is a separate, explicit request. */
async function getSecrets()
{
  const entries = await readSecretStore();
  return entries.map((e) => ({
    id: e.name,
    name: e.name,
    type: e.type || 'env',
    environment: e.environment || 'production',
    // A fixed mask: revealing even the length of a secret is unnecessary.
    maskedValue: '••••••••',
    updatedBy: 'agent',
    updatedAt: e.updatedAt,
  }));
}

async function upsertSecret({ name, value, type, environment })
{
  if (typeof name !== 'string' || !SECRET_NAME.test(name)) {
    return { status: 400, body: { success: false, error: 'Name must match [A-Za-z_][A-Za-z0-9_]{0,64}' } };
  }
  if (typeof value !== 'string' || value.length === 0) {
    return { status: 400, body: { success: false, error: 'A non-empty value is required' } };
  }
  if (value.length > 8192) {
    return { status: 400, body: { success: false, error: 'Value exceeds 8 KiB' } };
  }

  const key = await getSecretsKey();
  const entries = await readSecretStore();
  const record = {
    name,
    type: typeof type === 'string' && type ? type.slice(0, 32) : 'env',
    environment: typeof environment === 'string' && environment ? environment.slice(0, 32) : 'production',
    updatedAt: new Date().toISOString(),
    ...encryptValue(key, value),
  };

  const idx = entries.findIndex((e) => e.name === name);
  if (idx >= 0) entries[idx] = record;
  else entries.push(record);

  await writeSecretStore(entries);
  return { status: 200, body: { success: true, name } };
}

async function deleteSecret(name)
{
  if (typeof name !== 'string' || !SECRET_NAME.test(name)) {
    return { status: 400, body: { success: false, error: 'Invalid secret name' } };
  }
  const entries = await readSecretStore();
  const remaining = entries.filter((e) => e.name !== name);
  if (remaining.length === entries.length) {
    return { status: 404, body: { success: false, error: 'Secret not found' } };
  }
  await writeSecretStore(remaining);
  return { status: 200, body: { success: true } };
}

async function revealSecret(name)
{
  if (typeof name !== 'string' || !SECRET_NAME.test(name)) {
    return { status: 400, body: { success: false, error: 'Invalid secret name' } };
  }
  const entries = await readSecretStore();
  const record = entries.find((e) => e.name === name);
  if (!record) return { status: 404, body: { success: false, error: 'Secret not found' } };

  try {
    const key = await getSecretsKey();
    return { status: 200, body: { success: true, name, value: decryptValue(key, record) } };
  } catch (e) {
    // A GCM tag mismatch means the store was tampered with or the key no longer matches.
    return { status: 500, body: { success: false, error: 'Could not decrypt - the key may have changed' } };
  }
}

// ---------------------------------------------------------------------------
// IP geolocation
// ---------------------------------------------------------------------------

// Optional ipinfo.io token. It lives here, server-side, rather than in the frontend: every VITE_*
// value is inlined into the public client bundle at build time, so a token placed there would be
// readable by anyone who loads the page.
const IPINFO_TOKEN = (process.env.AGENT_IPINFO_TOKEN || '').trim();

/** Fetch JSON with a timeout, returning null on any failure rather than throwing. */
async function fetchJson(url, timeoutMs = 8000)
{
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Geolocate an IP address, proxied so the ipinfo.io token never reaches the browser.
 *
 * ipinfo's /lite endpoint is country-level only - it returns no city or region - so those fields
 * come back null when it is the source, rather than being filled in from somewhere else and
 * presented as if ipinfo had supplied them. Without a token the agent falls back to ipapi.co,
 * which is keyless and does report a city.
 */
/**
 * The host's own public address, resolved once and cached.
 *
 * The agent asking ipify server-side gets the *server's* egress address, which
 * is exactly the answer wanted. The browser asking the same service gets the
 * browser's address - which is why this must not be delegated to the client:
 * doing so reported the operator's home IP as the server's public IP.
 *
 * Cached because /node is polled; a failure returns null rather than a guess.
 */
const PUBLIC_IP_TTL_MS = 60 * 60 * 1000;
let publicIpCache = { value: null, at: 0 };

async function resolvePublicIp()
{
  const now = Date.now();
  if (publicIpCache.value && now - publicIpCache.at < PUBLIC_IP_TTL_MS) {
    return publicIpCache.value;
  }
  const self = await fetchJson('https://api.ipify.org?format=json');
  const ip = (self && typeof self.ip === 'string' && self.ip.trim()) || null;
  if (ip) publicIpCache = { value: ip, at: now };
  return ip;
}

/**
 * ipinfo.io's country code -> a display name, via the ICU data Node already ships.
 *
 * The standard endpoint returns `country` as a two-letter code ("US"), not a
 * name, so rendering it raw would put "US" where the UI expects "United States".
 */
const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch (e) {
    // A Node built without full ICU has no region data; the code is still shown.
    return null;
  }
})();

function countryNameFrom(code)
{
  if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return null;
  if (!REGION_NAMES) return code.toUpperCase();
  try {
    const name = REGION_NAMES.of(code.toUpperCase());
    // Intl echoes the input back for codes it does not know, which is no better
    // than the raw code and should not be presented as a resolved name.
    return name && name !== code.toUpperCase() ? name : code.toUpperCase();
  } catch (e) {
    return code.toUpperCase();
  }
}

/**
 * Split ipinfo's combined `org` field into its ASN and the operator name.
 *
 * It arrives as "AS15169 Google LLC". Some records carry no ASN at all, in which
 * case the whole string is the name and the ASN stays null rather than being
 * guessed at.
 */
function splitOrg(org)
{
  const text = typeof org === 'string' ? org.trim() : '';
  if (!text) return { asn: null, org: null };
  const match = /^(AS\d+)\s+(.*)$/.exec(text);
  return match ? { asn: match[1], org: match[2] || null } : { asn: null, org: text };
}

function emptyIpInfo(ip)
{
  return {
    ip: ip || null,
    city: null,
    region: null,
    country: null,
    countryCode: null,
    continent: null,
    org: null,
    asn: null,
    latitude: null,
    longitude: null,
    timezone: null,
    postal: null,
    hostname: null,
    source: null,
  };
}

async function lookupIpInfo(targetIp)
{
  let ip = typeof targetIp === 'string' ? targetIp.trim() : '';

  // Resolve the host's own public address when none was supplied. A private or loopback address is
  // not externally routable, so geolocating it would describe the wrong machine.
  if (!ip || ip === 'localhost' || /^127\./.test(ip) || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) {
    ip = (await resolvePublicIp()) || '';
  }
  if (!ip) return emptyIpInfo(null);

  // ipinfo.io's standard endpoint. It works with no token at all (1k lookups/day)
  // and returns city, region, coordinates, org and timezone; a free token raises
  // the allowance to 50k/month over the same URL and the same fields.
  //
  // This deliberately does NOT use api.ipinfo.io/lite: that endpoint 403s without
  // a token, and even with one it is country-level only, which is why the server
  // card used to render a location with no city in it.
  const query = IPINFO_TOKEN ? `?token=${encodeURIComponent(IPINFO_TOKEN)}` : '';
  const data = await fetchJson(`https://ipinfo.io/${encodeURIComponent(ip)}/json${query}`);

  // `bogon` marks a reserved/unroutable address. ipinfo answers 200 with no
  // location for those, so treat it as "nothing known" rather than a failure.
  if (data && data.bogon) return { ...emptyIpInfo(data.ip || ip), source: 'ipinfo.io' };

  if (data && !data.error) {
    const { asn, org } = splitOrg(data.org);
    const [lat, lon] = typeof data.loc === 'string' ? data.loc.split(',') : [];
    return {
      ip: data.ip || ip,
      city: data.city || null,
      region: data.region || null,
      country: countryNameFrom(data.country),
      countryCode: data.country ? String(data.country).toUpperCase() : null,
      continent: null,
      org,
      asn,
      latitude: lat ? Number.parseFloat(lat) : null,
      longitude: lon ? Number.parseFloat(lon) : null,
      timezone: data.timezone || null,
      postal: data.postal || null,
      hostname: data.hostname || null,
      source: 'ipinfo.io',
    };
  }

  // ipinfo failed (rate limit, network, revoked token). ipapi.co is keyless and
  // reports the same core fields, so the UI keeps working rather than going blank.
  const geo = await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
  if (!geo || geo.error) return emptyIpInfo(ip);

  return {
    ip,
    city: geo.city || null,
    region: geo.region || null,
    country: geo.country_name || null,
    countryCode: geo.country_code || null,
    continent: null,
    org: geo.org || null,
    asn: geo.asn || null,
    latitude: typeof geo.latitude === 'number' ? geo.latitude : null,
    longitude: typeof geo.longitude === 'number' ? geo.longitude : null,
    timezone: geo.timezone || null,
    postal: geo.postal || null,
    hostname: null,
    source: 'ipapi.co',
  };
}


// ---------------------------------------------------------------------------
// Node payload
// ---------------------------------------------------------------------------

function primaryIpAddress()
{
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
}

async function getNodePayload()
{
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
      // Resolved server-side. Leaving this null made the UI fall back to a
      // browser-side lookup, which reported the operator's own device IP as
      // the server's public address.
      publicIp: await resolvePublicIp(),
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
function parseJsonBody(req, limit = MAX_JSON_BODY_BYTES)
{
  return new Promise((resolve) =>
  {
    let size = 0;
    const chunks = [];
    let settled = false;

    const finish = (value) =>
    {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    req.on('data', (chunk) =>
    {
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
    req.on('end', () =>
    {
      try {
        finish({ body: JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}') });
      } catch (e) {
        finish({ error: 'Malformed JSON body', status: 400 });
      }
    });
    req.on('error', () => finish({ error: 'Request stream error', status: 400 }));
  });
}

function sendJson(res, status, payload)
{
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

function applyCors(req, res)
{
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser client, or a same-origin GET

  // Browsers attach Origin to same-origin POST/PUT/DELETE (but not same-origin GET). Treating a
  // bare Origin as cross-origin therefore rejected every write from the app's own page while all
  // reads succeeded. Compare against the Host the request arrived on before deciding.
  //
  // Compare HOSTNAMES, not host:port. Behind a reverse proxy the two ports need not agree: nginx's
  // `$host` drops the port while the browser's Origin keeps it, so a deployment on any non-default
  // port would otherwise 403 every write. The bearer token remains the actual access control here;
  // set AGENT_ALLOWED_ORIGINS if you need strict per-origin matching.
  const host = req.headers.host;
  if (host) {
    try {
      const originHost = new URL(origin).hostname;
      // `host` may or may not carry a port; strip it, handling bracketed IPv6 literals.
      const bare = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
      const hostname = bare.replace(/^\[|\]$/g, '');
      if (originHost && originHost === hostname) return true;
    } catch (e) {
      // Malformed Origin header; fall through to the allowlist check.
    }
  }

  if (!CORS_ORIGINS.includes(origin)) {
    // No wildcard: the agent serves privileged host data behind a bearer token, so genuinely
    // cross-origin access is opt-in via AGENT_ALLOWED_ORIGINS only.
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

function execErrorPayload(e)
{
  if (e && e.killed) return 'Command timed out';
  return (e && (e.stderr || e.stdout || e.message)) || 'Command failed';
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(req, res)
{
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
  // ---- Dashboard accounts -------------------------------------------------
  // These sit ahead of the authorization gate because signing in cannot itself
  // require being signed in. Each one does its own checking.

  // Whether any account exists yet, so the UI can offer first-run setup instead
  // of a login form nobody can pass. Reveals no account details.
  if (method === 'GET' && pathname === '/api/v1/auth/status') {
    const users = await readUsers();
    sendJson(res, 200, {
      configured: users.length > 0,
      // A deployment with no accounts is protected only by the agent token, and
      // the UI says so rather than implying the dashboard is locked down.
      minPasswordLength: MIN_PASSWORD_LENGTH,
    });
    return;
  }

  // Create the first account. Allowed only while the store is empty AND the
  // caller holds the agent token, which the operator already has from the
  // installer - so this is never an open registration endpoint on a reachable
  // host.
  if (method === 'POST' && pathname === '/api/v1/auth/bootstrap') {
    if (isLockedOut(ip)) {
      sendJson(res, 429, { error: 'Too many failed attempts. Try again later.' });
      return;
    }
    const existing = await readUsers();
    if (existing.length > 0) {
      sendJson(res, 409, { error: 'An account already exists. Sign in instead.' });
      return;
    }
    if (!hasAgentToken(req)) {
      recordAuthFailure(ip);
      sendJson(res, 401, { error: 'Creating the first account requires the agent token' });
      return;
    }

    const parsed = await parseJsonBody(req, 8 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { error: parsed.error });
      return;
    }
    const username = normaliseUsername(parsed.body?.username);
    const password = parsed.body?.password;
    const invalid = validateCredentials(username, password);
    if (invalid) {
      sendJson(res, 400, { error: invalid });
      return;
    }

    const user = {
      id: crypto.randomUUID(),
      username,
      role: 'owner',
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await writeUsers([user]);
    console.log(`[VPSGUI Agent] Dashboard account created: ${username}`);

    const token = createSession(user);
    setSessionCookie(res, req, token);
    sendJson(res, 200, { user: { id: user.id, username: user.username, role: user.role } });
    return;
  }

  if (method === 'POST' && pathname === '/api/v1/auth/login') {
    if (isLockedOut(ip)) {
      sendJson(res, 429, { error: 'Too many failed sign-in attempts. Try again later.' });
      return;
    }
    const parsed = await parseJsonBody(req, 8 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { error: parsed.error });
      return;
    }

    const username = normaliseUsername(parsed.body?.username);
    const password = String(parsed.body?.password ?? '');
    const users = await readUsers();
    const user = users.find((u) => u.username === username);

    // Verify against a decoy hash when the username is unknown, so the response
    // takes the same time either way and cannot be used to enumerate accounts.
    const ok = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, await decoyPasswordHash()).then(() => false);

    if (!ok) {
      recordAuthFailure(ip);
      // One message for both cases, for the same reason.
      sendJson(res, 401, { error: 'Incorrect username or password' });
      return;
    }

    authFailures.delete(ip);
    const token = createSession(user);
    setSessionCookie(res, req, token);
    sendJson(res, 200, { user: { id: user.id, username: user.username, role: user.role } });
    return;
  }

  if (method === 'POST' && pathname === '/api/v1/auth/logout') {
    destroySession(parseCookies(req)[SESSION_COOKIE]);
    clearSessionCookie(res, req);
    sendJson(res, 200, { success: true });
    return;
  }

  if (method === 'GET' && pathname === '/api/v1/auth/me') {
    const who = authenticateRequest(req);
    if (!who) {
      sendJson(res, 401, { error: 'Not signed in' });
      return;
    }
    sendJson(res, 200, {
      // A token-authenticated caller is a script, not a person; say so rather
      // than inventing a user record for it.
      kind: who.kind,
      user: who.user
        ? { id: who.user.userId, username: who.user.username, role: who.user.role }
        : null,
    });
    return;
  }

  if (method === 'POST' && pathname === '/api/v1/auth/password') {
    const who = authenticateRequest(req);
    if (!who || who.kind !== 'session') {
      sendJson(res, 401, { error: 'Sign in to change your password' });
      return;
    }
    if (isLockedOut(ip)) {
      sendJson(res, 429, { error: 'Too many failed attempts. Try again later.' });
      return;
    }

    const parsed = await parseJsonBody(req, 8 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { error: parsed.error });
      return;
    }

    const users = await readUsers();
    const index = users.findIndex((u) => u.id === who.user.userId);
    if (index < 0) {
      sendJson(res, 401, { error: 'Account no longer exists' });
      return;
    }

    const current = String(parsed.body?.currentPassword ?? '');
    const next = parsed.body?.newPassword;
    if (!(await verifyPassword(current, users[index].passwordHash))) {
      recordAuthFailure(ip);
      sendJson(res, 401, { error: 'Current password is incorrect' });
      return;
    }
    const invalid = validateCredentials(users[index].username, next);
    if (invalid) {
      sendJson(res, 400, { error: invalid });
      return;
    }

    users[index].passwordHash = await hashPassword(next);
    users[index].updatedAt = new Date().toISOString();
    await writeUsers(users);

    // Every other session for this account dies with the old password; the
    // caller gets a fresh one so they are not signed out of the tab they are in.
    destroySessionsForUser(users[index].id);
    const token = createSession(users[index]);
    setSessionCookie(res, req, token);
    authFailures.delete(ip);
    sendJson(res, 200, { success: true });
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
  if (method === 'GET' && pathname === '/api/v1/storage/partitions') {
    sendJson(res, 200, await getStoragePartitions());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/network/ip-info') {
    sendJson(res, 200, await lookupIpInfo(reqUrl.searchParams.get('ip') || ''));
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/network/interfaces') {
    sendJson(res, 200, getNetworkInterfaces());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/security/firewall') {
    sendJson(res, 200, await getFirewallRules());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/security/ssh-keys') {
    sendJson(res, 200, await getSshKeys());
    return;
  }
  if (method === 'POST' && pathname === '/api/v1/proxy/rules') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const result = await createProxyRule(parsed.body);
    sendJson(res, result.status, result.body);
    return;
  }

  if (method === 'GET' && pathname === '/api/v1/proxy/rules') {
    sendJson(res, 200, await getProxyRules());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/databases') {
    sendJson(res, 200, await getDatabases());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/catalog') {
    sendJson(res, 200, CATALOG_ITEMS);
    return;
  }

  if (method === 'GET' && pathname === '/api/v1/users') {
    sendJson(res, 200, await getSystemUsers());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/security/audit-logs') {
    sendJson(res, 200, await getAuditLogs());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/health/matrix') {
    sendJson(res, 200, await getHealthMatrix());
    return;
  }
  // Per-node detail. Matched before the bare /topology route would swallow it.
  if (method === 'GET' && pathname.startsWith('/api/v1/topology/node/')) {
    const nodeId = decodeURIComponent(pathname.slice('/api/v1/topology/node/'.length));
    const detail = await getTopologyNodeDetail(nodeId);
    if (!detail) {
      sendJson(res, 404, { error: `Unknown topology node: ${nodeId}` });
      return;
    }
    sendJson(res, 200, detail);
    return;
  }

  if (method === 'GET' && pathname === '/api/v1/topology') {
    sendJson(res, 200, await getTopology());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/queue/jobs') {
    sendJson(res, 200, await getQueueJobs());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/automation/workflows') {
    sendJson(res, 200, await getAutomationWorkflows());
    return;
  }
  if (method === 'GET' && pathname === '/api/v1/agent/info') {
    sendJson(res, 200, {
      version: AGENT_VERSION,
      shellEnabled: SHELL_ENABLED,
      fileRoots: FILE_ROOTS,
      platform: os.platform(),
      // Lets the UI explain an empty page instead of implying the host simply has none.
      unimplementedFeatures: UNIMPLEMENTED_FEATURES,
      // Whether a token is set - never the token itself.
      ipinfoConfigured: Boolean(IPINFO_TOKEN),
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
      sendJson(res, safe.status, { error: safe.error, roots: FILE_ROOTS });
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
            system: isSystemPath(safe.path),
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
        system: isSystemPath(safe.path),
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
      sendJson(res, safe.status, { success: false, error: safe.error, roots: FILE_ROOTS });
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
      sendJson(res, 200, {
        success: true,
        path: safe.path,
        bytesWritten: Buffer.byteLength(content, 'utf-8'),
        system: isSystemPath(safe.path),
      });
    } catch (e) {
      sendJson(res, 500, { success: false, error: e.message });
    }
    return;
  }

  // ---- Firewall rule changes ----
  if (method === 'POST' && pathname === '/api/v1/security/firewall/action') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, output: parsed.error });
      return;
    }
    const result = await applyFirewallAction(parsed.body);
    sendJson(res, result.invalid ? 400 : 200, { success: result.success, output: result.output });
    return;
  }

  // ---- Filesystem mutations ----
  if (method === 'POST' && pathname === '/api/v1/files/mkdir') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const result = await createDirectory(parsed.body.path);
    sendJson(res, result.status, result.body);
    return;
  }

  if (method === 'POST' && pathname === '/api/v1/files/delete') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const result = await deletePath(parsed.body.path, parsed.body.recursive === true);
    sendJson(res, result.status, result.body);
    return;
  }

  if (method === 'POST' && pathname === '/api/v1/files/rename') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const result = await renamePath(parsed.body.from, parsed.body.to);
    sendJson(res, result.status, result.body);
    return;
  }

  // ---- Deployments (git checkouts) ----
  if (method === 'GET' && pathname === '/api/v1/deployments') {
    sendJson(res, 200, await getDeployments());
    return;
  }
  if (method === 'POST' && pathname === '/api/v1/deployments/pull') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, output: parsed.error });
      return;
    }
    const result = await pullDeployment(parsed.body.path);
    sendJson(res, result.status, result.body);
    return;
  }

  // ---- Backups (tar.gz archives) ----
  if (method === 'GET' && pathname === '/api/v1/backups') {
    sendJson(res, 200, await getBackups());
    return;
  }
  if (method === 'POST' && pathname === '/api/v1/backups/create') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const result = await createBackup(parsed.body.sourcePath, parsed.body.label);
    sendJson(res, result.status, result.body);
    return;
  }
  if (method === 'POST' && pathname === '/api/v1/backups/delete') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const result = await deleteBackup(parsed.body.name);
    sendJson(res, result.status, result.body);
    return;
  }
  if (method === 'POST' && pathname === '/api/v1/backups/restore') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const result = await restoreBackup(parsed.body.name, parsed.body.destination);
    sendJson(res, result.status, result.body);
    return;
  }

  // ---- Secrets (encrypted at rest) ----
  if (method === 'GET' && pathname === '/api/v1/security/secrets') {
    sendJson(res, 200, await getSecrets());
    return;
  }
  if (method === 'POST' && pathname === '/api/v1/security/secrets') {
    const parsed = await parseJsonBody(req, 32 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const result = await upsertSecret(parsed.body || {});
    sendJson(res, result.status, result.body);
    return;
  }
  if (method === 'POST' && pathname === '/api/v1/security/secrets/delete') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const result = await deleteSecret(parsed.body.name);
    sendJson(res, result.status, result.body);
    return;
  }
  if (method === 'POST' && pathname === '/api/v1/security/secrets/reveal') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, error: parsed.error });
      return;
    }
    const result = await revealSecret(parsed.body.name);
    sendJson(res, result.status, result.body);
    return;
  }

  // ---- Docker image removal ----
  if (method === 'POST' && pathname === '/api/v1/docker/images/action') {
    const parsed = await parseJsonBody(req, 16 * 1024);
    if (parsed.error) {
      sendJson(res, parsed.status, { success: false, output: parsed.error });
      return;
    }
    const { id, action, force } = parsed.body;
    if (action !== 'remove' || typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/.test(id)) {
      sendJson(res, 400, { success: false, output: 'Invalid action or image id' });
      return;
    }
    try {
      // -f is opt-in: without it docker refuses to remove an image still used by a container.
      const args = force === true ? ['rmi', '-f', '--', id] : ['rmi', '--', id];
      const output = await run('docker', args, { timeout: 60000 });
      sendJson(res, 200, { success: true, output: output.trim() });
    } catch (e) {
      sendJson(res, 200, { success: false, output: execErrorPayload(e) });
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

const server = http.createServer((req, res) =>
{
  handleRequest(req, res).catch((err) =>
  {
    console.error('[VPSGUI Agent] Unhandled request error:', err);
    // Never echo the raw error to the client: stack traces disclose host paths.
    sendJson(res, 500, { error: 'Internal agent error' });
  });
});

// Drop slow-loris style connections that open a socket and never send a complete request.
server.headersTimeout = 20000;
server.requestTimeout = 60000;
server.keepAliveTimeout = 10000;

server.on('clientError', (err, socket) =>
{
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

// A daemon that dies on one bad request takes host monitoring down with it.
process.on('uncaughtException', (err) =>
{
  console.error('[VPSGUI Agent] Uncaught exception:', err);
});
process.on('unhandledRejection', (err) =>
{
  console.error('[VPSGUI Agent] Unhandled rejection:', err);
});

function shutdown(signal)
{
  console.log(`[VPSGUI Agent] Received ${signal}, shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, HOST, () =>
{
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
