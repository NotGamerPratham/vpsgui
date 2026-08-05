# VPSGUI Client SDK Specification

VPSGUI provides official SDK packages for programmatic interaction with the VPSGUI REST API.

---

## Packages

| Package | Language | Location | Registry Target |
|---------|----------|----------|-----------------|
| `@vpsgui/sdk` | TypeScript / Node.js | `sdk/node` | npm |
| `vpsgui` | Python 3.8+ | `sdk/python` | PyPI |

---

## Design Pattern

Both SDKs follow a **resource-oriented client architecture**:

```
client = VpsguiClient(base_url, token)
client.nodes.list()
client.docker.list_containers()
client.system.telemetry()
client.files.list(path)
client.security.list_firewall_rules()
```

---

## API Resource Mapping

| Resource Accessor | REST Endpoint | Description |
|-------------------|---------------|-------------|
| `nodes` | `/api/v1/nodes` | Manage VPS compute nodes |
| `docker` | `/api/v1/docker/*` | Container and image management |
| `system` | `/api/v1/system/*` | Hardware telemetry and process tree |
| `files` | `/api/v1/files*` | File system navigation & inspection |
| `security` | `/api/v1/security/*` | Firewall, secrets, audit logs, SSH keys |
| `catalog` | `/api/v1/catalog` | Open catalog stack deployments |
| `automation` | `/api/v1/automation/*` | Automated workflow triggers |
| `queue` | `/api/v1/queue/jobs` | Asynchronous job status |
| `health` | `/api/v1/health/matrix` | Single-pane health checks |
