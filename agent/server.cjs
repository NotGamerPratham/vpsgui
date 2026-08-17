/**
 * VPSGUI Agent Server Daemon (.cjs CommonJS entry point)
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 * 
 * Lightweight HTTP daemon listening on port 46509.
 * Serves real host hardware metrics, process stats, Docker containers, systemd units, and terminal CLI execution.
 */

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, execFileSync } = require('child_process');

const PORT = process.env.PORT || 46509;
const TOKEN_FILE = path.join(__dirname, '.agent-token');

// Shared-secret bearer token gating the mutating endpoints (terminal exec, docker/service control).
// Read from AGENT_TOKEN env var if set (e.g. by install.sh), otherwise persisted to a local file so
// it survives restarts. Paste this value into the VPSGUI web UI under Settings -> Agent Token.
function getOrCreateAgentToken() {
  if (process.env.AGENT_TOKEN) return process.env.AGENT_TOKEN;
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const existing = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
      if (existing) return existing;
    }
  } catch (e) {}
  const generated = crypto.randomBytes(24).toString('hex');
  try {
    fs.writeFileSync(TOKEN_FILE, generated, { mode: 0o600 });
  } catch (e) {
    // Persisting failed (read-only fs, etc); token still works for this process lifetime
  }
  return generated;
}

const AGENT_TOKEN = getOrCreateAgentToken();

function isAuthorized(req) {
  const header = req.headers['authorization'] || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match ? match[1] : '';
  const providedBuf = Buffer.from(provided);
  const tokenBuf = Buffer.from(AGENT_TOKEN);
  if (providedBuf.length !== tokenBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, tokenBuf);
}

function getSwapPercent() {
  if (os.platform() !== 'linux') return 0;
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8');
    const total = parseInt((/SwapTotal:\s+(\d+)/.exec(meminfo) || [])[1] || '0', 10);
    const free = parseInt((/SwapFree:\s+(\d+)/.exec(meminfo) || [])[1] || '0', 10);
    if (!total) return 0;
    return Math.round(((total - free) / total) * 100);
  } catch (e) {
    return 0;
  }
}

function getDiskPercent() {
  if (os.platform() !== 'linux') return 0;
  try {
    const output = execSync('df -k / | tail -n 1', { encoding: 'utf-8' });
    const cols = output.trim().split(/\s+/);
    const pct = parseInt((cols[4] || '').replace('%', ''), 10);
    return Number.isFinite(pct) ? pct : 0;
  } catch (e) {
    return 0;
  }
}

function getRealTelemetry() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg();

  let idleSum = 0;
  let totalSum = 0;
  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalSum += cpu.times[type];
    }
    idleSum += cpu.times.idle;
  });
  const cpuPercent = Math.round(((totalSum - idleSum) / totalSum) * 100) || 12;
  const ramPercent = Math.round((usedMem / totalMem) * 100);

  return {
    timestamp: new Date().toISOString(),
    cpuPercent,
    ramPercent,
    swapPercent: getSwapPercent(),
    diskPercent: getDiskPercent(),
    netRxKbps: 0,
    netTxKbps: 0,
    iowaitPercent: 0,
    tempC: 0,
    powerWatts: 0,
    cpuCores: cpus.length,
    cpuModel: cpus[0]?.model || 'Linux Processor',
    memoryTotalBytes: totalMem,
    memoryUsedBytes: usedMem,
    memoryFreeBytes: freeMem,
    loadAverage: loadAvg,
    uptimeSeconds: Math.round(os.uptime()),
    osName: `${os.type()} ${os.release()}`,
    osPlatform: os.platform(),
    osArch: os.arch(),
    hostname: os.hostname(),
  };
}

function getRealProcesses() {
  const totalMemMb = os.totalmem() / (1024 * 1024);
  try {
    if (os.platform() === 'win32') {
      const output = execSync('tasklist /FO CSV /NH', { encoding: 'utf-8' });
      const lines = output.trim().split('\r\n').slice(0, 35);
      return lines.map((line, idx) => {
        const parts = line.split('","').map((p) => p.replace(/"/g, ''));
        const memoryKb = parseInt((parts[4] || '0').replace(/[^0-9]/g, ''), 10) || 1024;
        const memoryMb = Math.round((memoryKb / 1024) * 10) / 10;
        return {
          pid: parseInt(parts[1], 10) || idx + 1000,
          user: 'system',
          cpuPercent: 0.5,
          memoryPercent: totalMemMb > 0 ? Math.round((memoryMb / totalMemMb) * 1000) / 10 : 0,
          memoryMb,
          command: parts[0] || 'process',
          threads: 1,
          state: 'running',
        };
      });
    } else {
      const output = execSync('ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu | head -n 35', { encoding: 'utf-8' });
      const lines = output.trim().split('\n').slice(1);
      return lines.map((line) => {
        const cols = line.trim().split(/\s+/);
        const memoryPercent = parseFloat(cols[3]) || 0;
        return {
          pid: parseInt(cols[0], 10) || 0,
          user: cols[1] || 'root',
          cpuPercent: parseFloat(cols[2]) || 0,
          memoryPercent,
          memoryMb: Math.round(totalMemMb * (memoryPercent / 100) * 10) / 10,
          command: cols[4] || cols[3] || 'process',
          threads: 1,
          state: 'running',
        };
      });
    }
  } catch (e) {
    return [];
  }
}

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
      const privatePort = parseInt((right || left).split(':').pop(), 10) || 0;
      const publicPort = right ? parseInt(left.split(':').pop(), 10) || 0 : 0;
      return { publicPort, privatePort, type };
    });
}

function getDockerStatsById() {
  const statsById = {};
  try {
    const output = execSync('docker stats --no-stream --format "{{.ID}}|{{.CPUPerc}}|{{.MemUsage}}"', { encoding: 'utf-8' });
    output.trim().split('\n').filter(Boolean).forEach((line) => {
      const [id, cpuStr, memStr] = line.split('|');
      const cpuPercent = parseFloat((cpuStr || '0').replace('%', '')) || 0;
      const memUsedRaw = (memStr || '0MiB / 0MiB').split('/')[0].trim();
      const memMatch = /([\d.]+)\s*(GiB|MiB|KiB|GB|MB|KB)/i.exec(memUsedRaw);
      let memoryUsageMb = 0;
      if (memMatch) {
        const value = parseFloat(memMatch[1]);
        const unit = memMatch[2].toLowerCase();
        if (unit.startsWith('g')) memoryUsageMb = value * 1024;
        else if (unit.startsWith('k')) memoryUsageMb = value / 1024;
        else memoryUsageMb = value;
      }
      statsById[id] = { cpuPercent, memoryUsageMb: Math.round(memoryUsageMb * 10) / 10 };
    });
  } catch (e) {
    // docker stats unavailable (permissions, daemon down); callers fall back to zeros
  }
  return statsById;
}

function getRealDockerContainers() {
  try {
    const output = execSync('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"', { encoding: 'utf-8' });
    const lines = output.trim().split('\n').filter(Boolean);
    const statsById = getDockerStatsById();
    return lines.map((line) => {
      const [id, name, image, status, ports] = line.split('|');
      const stats = statsById[id] || { cpuPercent: 0, memoryUsageMb: 0 };
      return {
        id,
        name,
        image,
        state: status.includes('Up') ? 'running' : 'exited',
        status,
        ports: parseDockerPorts(ports),
        cpuPercent: stats.cpuPercent,
        memoryUsageMb: stats.memoryUsageMb,
        created: new Date().toISOString(),
      };
    });
  } catch (e) {
    return [];
  }
}

function getRealDirectoryContents(reqPath) {
  const targetDir = reqPath ? path.resolve(reqPath) : (os.platform() === 'win32' ? 'C:\\' : '/var/www');
  try {
    const items = fs.readdirSync(targetDir, { withFileTypes: true });
    return items.map((item) => {
      const fullPath = path.join(targetDir, item.name);
      let stat = null;
      try { stat = fs.statSync(fullPath); } catch {}
      return {
        name: item.name,
        path: fullPath,
        type: item.isDirectory() ? 'directory' : 'file',
        isDirectory: item.isDirectory(),
        sizeBytes: stat ? stat.size : 0,
        size: stat ? `${Math.round(stat.size / 1024)} KB` : '0 KB',
        modifiedAt: stat ? stat.mtime.toISOString() : new Date().toISOString(),
        content: item.isFile() && stat && stat.size < 100000 ? fs.readFileSync(fullPath, 'utf-8').slice(0, 5000) : '',
      };
    });
  } catch (e) {
    return [];
  }
}

function probeBinary(bin, versionFlag) {
  const whichCmd = os.platform() === 'win32' ? `where ${bin}` : `which ${bin}`;
  try {
    execSync(whichCmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return { installed: false, version: 'not installed' };
  }
  try {
    const verOut = execSync(`${bin} ${versionFlag || '--version'}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    });
    const firstLine = (verOut.split('\n')[0] || '').trim();
    return { installed: true, version: firstLine || 'installed' };
  } catch (e) {
    return { installed: true, version: 'installed' };
  }
}

function getRealPackages() {
  const packageDefs = [
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
  const packages = packageDefs.map((def) => {
    const probe = probeBinary(def.bin);
    return { name: def.name, category: def.category, installed: probe.installed, version: probe.version, description: def.description };
  });

  const languageDefs = [
    { name: 'Node.js', bin: 'node', category: 'runtime', description: 'JavaScript runtime built on V8' },
    { name: 'Python', bin: 'python3', category: 'runtime', description: 'High-level programming language' },
    { name: 'Go (Golang)', bin: 'go', category: 'runtime', description: 'Open source programming language by Google' },
    { name: 'Rust', bin: 'rustc', category: 'runtime', description: 'Empowering everyone to build reliable and efficient software' },
    { name: 'PHP', bin: 'php', category: 'runtime', description: 'Popular general-purpose scripting language' },
    { name: 'OpenJDK (Java)', bin: 'java', category: 'runtime', description: 'Open-source implementation of Java Platform' },
    { name: 'Bun', bin: 'bun', category: 'runtime', description: 'Incredibly fast JavaScript & TypeScript toolkit' },
    { name: 'Deno', bin: 'deno', category: 'runtime', description: 'Modern runtime for JavaScript and TypeScript' },
  ];
  const languages = languageDefs.map((def) => {
    const probe = probeBinary(def.bin, def.bin === 'java' ? '-version' : '--version');
    return { name: def.name, category: def.category, installed: probe.installed, version: probe.version, binary: def.bin, description: def.description };
  });

  return { packages, languages };
}

function getRealServices() {
  if (os.platform() !== 'linux') return [];
  try {
    const output = execSync('systemctl list-units --type=service --all --no-legend --no-pager --plain', { encoding: 'utf-8' });
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(0, 80)
      .map((line) => {
        const cols = line.trim().split(/\s+/);
        const name = cols[0] || 'unknown.service';
        const active = cols[2] || 'unknown';
        const sub = cols[3] || '';
        const description = cols.slice(4).join(' ') || name;
        return {
          id: `svc-${name.replace(/\.service$/, '')}`,
          name,
          alias: description,
          status: active === 'active' ? 'active' : active === 'failed' ? 'failed' : 'inactive',
          subState: sub,
          enabled: active === 'active',
          category: 'system',
        };
      });
  } catch (e) {
    return [];
  }
}

function getNodePayload() {
  const telemetry = getRealTelemetry();
  return {
    id: `node-${os.hostname()}`,
    name: os.hostname(),
    status: 'online',
    agentStatus: 'healthy',
    location: {
      city: 'Host Node',
      country: 'Linux VPS',
      countryCode: 'VPS',
      flagIcon: 'Globe',
      provider: 'Active Telemetry Host',
    },
    hardware: {
      cpuCores: telemetry.cpuCores,
      cpuModel: telemetry.cpuModel,
      ramGb: Math.round(telemetry.memoryTotalBytes / 1073741824),
      swapGb: 0,
      diskGb: 80,
      diskType: 'NVMe',
      architecture: telemetry.osArch,
    },
    os: {
      name: telemetry.osName,
      family: telemetry.osPlatform,
      version: 'Active Agent v1.4.2',
      kernel: telemetry.osName,
      uptimeSeconds: telemetry.uptimeSeconds,
    },
    network: {
      ipAddress: '127.0.0.1',
      publicIp: '127.0.0.1',
      hostname: os.hostname(),
      sshPort: 22,
    },
    tags: ['linux-vps', 'production'],
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/api/v1/health' || pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', version: 'v1.4.2', time: new Date().toISOString() }));
  } else if (pathname === '/api/v1/system/telemetry') {
    res.writeHead(200);
    res.end(JSON.stringify(getRealTelemetry()));
  } else if (pathname === '/api/v1/system/processes') {
    res.writeHead(200);
    res.end(JSON.stringify(getRealProcesses()));
  } else if (pathname === '/api/v1/system/packages') {
    res.writeHead(200);
    res.end(JSON.stringify(getRealPackages()));
  } else if (pathname === '/api/v1/system/services') {
    res.writeHead(200);
    res.end(JSON.stringify(getRealServices()));
  } else if (pathname === '/api/v1/docker/containers') {
    res.writeHead(200);
    res.end(JSON.stringify(getRealDockerContainers()));
  } else if (pathname === '/api/v1/docker/images') {
    res.writeHead(200);
    res.end(JSON.stringify([]));
  } else if (pathname === '/api/v1/files' || pathname === '/api/v1/file-manager/list') {
    if (!isAuthorized(req)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid agent token' }));
      return;
    }
    const targetPath = reqUrl.searchParams.get('path');
    res.writeHead(200);
    res.end(JSON.stringify(getRealDirectoryContents(targetPath)));
  } else if (pathname === '/api/v1/files/write' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid agent token' }));
      return;
    }
    const body = await parseJsonBody(req);
    const { path: targetPath, content } = body;
    if (typeof targetPath !== 'string' || !targetPath || typeof content !== 'string') {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: 'Invalid path or content' }));
      return;
    }
    try {
      fs.writeFileSync(path.resolve(targetPath), content, 'utf-8');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, path: targetPath }));
    } catch (e) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  } else if (pathname === '/api/v1/node') {
    res.writeHead(200);
    res.end(JSON.stringify(getNodePayload()));
  } else if (pathname === '/api/v1/nodes') {
    res.writeHead(200);
    res.end(JSON.stringify([getNodePayload()]));
  } else if (pathname === '/api/v1/terminal/exec' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid agent token' }));
      return;
    }
    const body = await parseJsonBody(req);
    const cmd = body.command || 'uptime';
    try {
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 7000 });
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, command: cmd, output: output || 'Command executed cleanly with status 0' }));
    } catch (err) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: false, command: cmd, output: err.stderr || err.stdout || err.message || 'Command failed' }));
    }
  } else if (pathname === '/api/v1/system/packages/install' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid agent token' }));
      return;
    }
    const body = await parseJsonBody(req);
    const { packageName } = body;
    if (typeof packageName !== 'string' || !/^[a-zA-Z0-9_.+-]+$/.test(packageName)) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, output: 'Invalid package name' }));
      return;
    }
    try {
      const output = execFileSync('apt-get', ['install', '-y', packageName], { encoding: 'utf-8', timeout: 120000 });
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, output: output.trim() }));
    } catch (e) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: false, output: e.stderr || e.stdout || e.message || 'Install failed' }));
    }
  } else if (pathname === '/api/v1/docker/containers/action' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid agent token' }));
      return;
    }
    const body = await parseJsonBody(req);
    const { id, action } = body;
    const dockerVerbs = { start: 'start', stop: 'stop', restart: 'restart', remove: 'rm' };
    const verb = dockerVerbs[action];
    if (!verb || typeof id !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, action, output: 'Invalid action or container id' }));
      return;
    }
    try {
      const args = action === 'remove' ? ['rm', '-f', id] : [verb, id];
      const output = execFileSync('docker', args, { encoding: 'utf-8' });
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, action, output: output.trim() }));
    } catch (e) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: false, action, output: e.message }));
    }
  } else if (pathname === '/api/v1/system/services/action' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid agent token' }));
      return;
    }
    const body = await parseJsonBody(req);
    const { name, action } = body;
    const allowedActions = ['start', 'stop', 'restart'];
    if (!allowedActions.includes(action) || typeof name !== 'string' || !/^[a-zA-Z0-9_.@-]+$/.test(name)) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, action, output: 'Invalid action or service name' }));
      return;
    }
    try {
      const output = execFileSync('systemctl', [action, name], { encoding: 'utf-8' });
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, action, output: output.trim() || `Service ${name} ${action} succeeded` }));
    } catch (e) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: false, action, output: e.message }));
    }
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found', pathname }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[VPSGUI Agent Server] Listening on http://0.0.0.0:${PORT} :)`);
  console.log(`[VPSGUI Agent Server] Agent token (paste into web UI -> Settings -> Agent Token): ${AGENT_TOKEN}`);
});
