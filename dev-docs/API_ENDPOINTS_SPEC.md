# VPSGUI REST API & WebSocket Protocol Specification (v1.4.2)

This document details the REST API endpoints and WebSocket event specifications implemented by the `vpsgui-agent` telemetry daemon (`agent/server.js`) listening on port `8080`.

---

## REST Endpoints (`/api/v1`)

### 1. Health Probe
- **Endpoint**: `GET /api/v1/health`
- **Description**: Returns agent status, active version, and server timestamp.
- **Response**:
```json
{
  "status": "ok",
  "version": "v1.4.2",
  "time": "2026-08-05T08:40:00.000Z"
}
```

### 2. Live System Telemetry
- **Endpoint**: `GET /api/v1/system/telemetry`
- **Description**: Returns hardware utilization metrics derived from host OS primitives.
- **Response**:
```json
{
  "timestamp": "2026-08-05T08:40:00.000Z",
  "cpuUsagePercent": 14,
  "cpuCores": 4,
  "cpuModel": "Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz",
  "memoryTotalBytes": 17179869184,
  "memoryUsedBytes": 4294967296,
  "memoryFreeBytes": 12884901888,
  "memoryUsagePercent": 25,
  "loadAverage": [0.15, 0.20, 0.18],
  "uptimeSeconds": 94820,
  "osName": "Linux 6.8.0-generic",
  "osPlatform": "linux",
  "osArch": "x86_64",
  "hostname": "vps128"
}
```

### 3. System Processes
- **Endpoint**: `GET /api/v1/system/processes`
- **Description**: Returns active host processes sorted by CPU utilization (`ps aux`).

### 4. Docker Engine Containers & Images
- **Endpoint**: `GET /api/v1/docker/containers`
- **Endpoint**: `GET /api/v1/docker/images`
- **Description**: Returns container status and docker images via `docker ps` execution.

### 5. File Manager & Directory Explorer
- **Endpoint**: `GET /api/v1/files?path=/var/www`
- **Description**: Returns directory listing and file contents for specified host path.

---

## WebSocket Stream (`/ws`)
- **Protocol**: `ws://<host>:8080/ws` or `wss://<domain>/ws`
- **Broadcast Events**:
  - `system_telemetry`: Emitted every 2000ms with updated CPU/RAM/Disk metrics.
  - `ws_connected`: Client connection handshake event.
