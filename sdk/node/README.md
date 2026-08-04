# @vpsgui/sdk

Official Node.js / TypeScript SDK for the **VPSGUI** REST API.

Manage VPS nodes, Docker containers, telemetry, files, security, databases, backups, and more -- all from TypeScript or JavaScript.

**Repository**: [github.com/NotGamerPratham/vpsgui](https://github.com/NotGamerPratham/vpsgui)
**Author**: [NotGamerPratham](https://notgamerpratham.com)

---

## Installation

```bash
npm install @vpsgui/sdk
```

---

## Quick Start

```typescript
import { VpsguiClient } from '@vpsgui/sdk';

const client = new VpsguiClient({
  baseUrl: 'https://your-vps-ip/api/v1',
  token: 'your-jwt-auth-token',
});

// List all connected VPS nodes
const nodes = await client.nodes.list();
console.log(nodes);

// List Docker containers
const containers = await client.docker.listContainers();

// Get system telemetry
const telemetry = await client.system.telemetry();

// Browse files on the VPS
const files = await client.files.list('/etc/nginx');

// List firewall rules
const rules = await client.security.listFirewallRules();
```

---

## API Reference

### `new VpsguiClient(config)`

| Parameter        | Type     | Required | Description                         |
|------------------|----------|----------|-------------------------------------|
| `config.baseUrl` | `string` | Yes      | VPSGUI API base URL                 |
| `config.token`   | `string` | No       | JWT Bearer authentication token     |
| `config.timeout` | `number` | No       | Request timeout in ms (default: 30000) |

### Resources

| Resource                | Methods                                                              |
|-------------------------|----------------------------------------------------------------------|
| `client.nodes`          | `list()`, `get(id)`, `create(payload)`, `delete(id)`, `reboot(id)` |
| `client.docker`         | `listContainers()`, `listImages()`, `startContainer(id)`, `stopContainer(id)`, `restartContainer(id)`, `deleteContainer(id)`, `containerLogs(id)` |
| `client.system`         | `telemetry()`, `processes()`                                        |
| `client.files`          | `list(path)`, `read(filePath)`                                      |
| `client.security`       | `listFirewallRules()`, `listSecrets()`, `listAuditLogs()`, `listSshKeys()` |
| `client.catalog`        | `list()`, `deploy(itemId, config)`                                  |
| `client.automation`     | `list()`, `trigger(workflowId)`                                     |
| `client.queue`          | `list()`                                                             |
| `client.storage`        | `listPartitions()`                                                   |
| `client.network`        | `listInterfaces()`                                                   |
| `client.backups`        | `list()`, `create(config)`, `restore(backupId)`                     |
| `client.databases`      | `list()`                                                             |
| `client.deployments`    | `list()`                                                             |
| `client.proxy`          | `list()`                                                             |
| `client.health`         | `matrix()`                                                           |

---

## Error Handling

```typescript
import { VpsguiClient, VpsguiApiError } from '@vpsgui/sdk';

try {
  const nodes = await client.nodes.list();
} catch (error) {
  if (error instanceof VpsguiApiError) {
    console.error(`API Error ${error.statusCode}: ${error.statusText}`);
    console.error('Response body:', error.body);
  }
}
```

---

## License

MIT -- [NotGamerPratham](https://notgamerpratham.com)
