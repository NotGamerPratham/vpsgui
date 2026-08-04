# VPSGUI REST & WebSocket API Reference

The VPSGUI API gateway exposes REST endpoints (`/api/v1`) and WebSocket streams (`/ws`) for managing nodes, telemetry, containers, files, and security.

## Authentication

All REST requests require a Bearer token header:
```http
Authorization: Bearer <YOUR_JWT_AUTH_TOKEN>
```

---

## Endpoints

### 1. Nodes & Servers

#### `GET /api/v1/nodes`
Returns array of connected Linux VPS nodes.

#### `POST /api/v1/nodes`
Registers a new node.
**Payload:**
```json
{
  "name": "vps-us-east-01",
  "ipAddress": "135.181.42.89",
  "sshPort": 22,
  "type": "linux",
  "tags": ["prod", "web"]
}
```

---

### 2. Docker Engine

#### `GET /api/v1/docker/containers`
Fetches running Docker containers from host `/var/run/docker.sock`.

#### `GET /api/v1/docker/images`
Fetches local Docker container images repository.

---

### 3. File System

#### `GET /api/v1/files?path=/etc`
Lists directory contents and permissions.

---

### 4. Telemetry Stream

#### `GET /api/v1/system/telemetry`
Returns recent system telemetry points.

#### `WS /ws`
Establishes a WebSocket connection streaming `telemetry_tick` events every 2 seconds.
