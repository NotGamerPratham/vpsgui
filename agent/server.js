const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 8080;

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
  const memPercent = Math.round((usedMem / totalMem) * 100);

  return {
    timestamp: new Date().toISOString(),
    cpuUsagePercent: cpuPercent,
    cpuCores: cpus.length,
    cpuModel: cpus[0]?.model || 'Linux Processor',
    memoryTotalBytes: totalMem,
    memoryUsedBytes: usedMem,
    memoryFreeBytes: freeMem,
    memoryUsagePercent: memPercent,
    loadAverage: loadAvg,
    uptimeSeconds: Math.round(os.uptime()),
    osName: `${os.type()} ${os.release()}`,
    osPlatform: os.platform(),
    osArch: os.arch(),
    hostname: os.hostname(),
  };
}

function getRealProcesses() {
  try {
    if (os.platform() === 'win32') {
      const output = execSync('tasklist /FO CSV /NH', { encoding: 'utf-8' });
      const lines = output.trim().split('\r\n').slice(0, 35);
      return lines.map((line, idx) => {
        const parts = line.split('","').map((p) => p.replace(/"/g, ''));
        return {
          pid: parseInt(parts[1], 10) || idx + 1000,
          name: parts[0] || 'process',
          user: 'system',
          cpuPercent: 0.5,
          memoryBytes: (parseInt((parts[4] || '0').replace(/[^0-9]/g, ''), 10) || 1024) * 1024,
          status: 'running',
        };
      });
    } else {
      const output = execSync('ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu | head -n 35', { encoding: 'utf-8' });
      const lines = output.trim().split('\n').slice(1);
      return lines.map((line) => {
        const cols = line.trim().split(/\s+/);
        return {
          pid: parseInt(cols[0], 10) || 0,
          name: cols[4] || cols[3] || 'process',
          user: cols[1] || 'root',
          cpuPercent: parseFloat(cols[2]) || 0,
          memoryPercent: parseFloat(cols[3]) || 0,
          status: 'running',
        };
      });
    }
  } catch (e) {
    return [];
  }
}

function getRealDockerContainers() {
  try {
    const output = execSync('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"', { encoding: 'utf-8' });
    const lines = output.trim().split('\n').filter(Boolean);
    return lines.map((line) => {
      const [id, name, image, status, ports] = line.split('|');
      return {
        id,
        name,
        image,
        status: status.includes('Up') ? 'running' : 'exited',
        ports: ports || 'N/A',
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

const server = http.createServer((req, res) => {
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
  } else if (pathname === '/api/v1/docker/containers') {
    res.writeHead(200);
    res.end(JSON.stringify(getRealDockerContainers()));
  } else if (pathname === '/api/v1/docker/images') {
    res.writeHead(200);
    res.end(JSON.stringify([]));
  } else if (pathname === '/api/v1/files' || pathname === '/api/v1/file-manager/list') {
    const targetPath = reqUrl.searchParams.get('path');
    res.writeHead(200);
    res.end(JSON.stringify(getRealDirectoryContents(targetPath)));
  } else if (pathname === '/api/v1/node') {
    res.writeHead(200);
    res.end(JSON.stringify(getNodePayload()));
  } else if (pathname === '/api/v1/nodes') {
    res.writeHead(200);
    res.end(JSON.stringify([getNodePayload()]));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found', pathname }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[VPSGUI Agent Server] Listening on http://0.0.0.0:${PORT}`);
});
