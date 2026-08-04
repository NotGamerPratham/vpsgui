# vpsgui

Official Python SDK for the **VPSGUI** REST API.

Manage VPS nodes, Docker containers, telemetry, files, security, databases, backups, and more -- all from Python.

**Repository**: [github.com/NotGamerPratham/vpsgui](https://github.com/NotGamerPratham/vpsgui)
**Author**: [NotGamerPratham](https://notgamerpratham.com)

---

## Installation

```bash
pip install vpsgui
```

---

## Quick Start

```python
from vpsgui import VpsguiClient

client = VpsguiClient(
    base_url="https://your-vps-ip/api/v1",
    token="your-jwt-auth-token",
)

# List all connected VPS nodes
nodes = client.nodes.list()
print(nodes)

# List Docker containers
containers = client.docker.list_containers()

# Get system telemetry
telemetry = client.system.telemetry()

# Browse files on the VPS
files = client.files.list("/etc/nginx")

# List firewall rules
rules = client.security.list_firewall_rules()
```

---

## API Reference

### `VpsguiClient(base_url, token=None, timeout=30)`

| Parameter  | Type  | Required | Description                             |
|------------|-------|----------|-----------------------------------------|
| `base_url` | `str` | Yes      | VPSGUI API base URL                     |
| `token`    | `str` | No       | JWT Bearer authentication token         |
| `timeout`  | `int` | No       | Request timeout in seconds (default: 30)|

### Resources

| Resource                | Methods                                                              |
|-------------------------|----------------------------------------------------------------------|
| `client.nodes`          | `list()`, `get(id)`, `create(payload)`, `delete(id)`, `reboot(id)` |
| `client.docker`         | `list_containers()`, `list_images()`, `start_container(id)`, `stop_container(id)`, `restart_container(id)`, `delete_container(id)`, `container_logs(id)` |
| `client.system`         | `telemetry()`, `processes()`                                        |
| `client.files`          | `list(path)`, `read(file_path)`                                     |
| `client.security`       | `list_firewall_rules()`, `list_secrets()`, `list_audit_logs()`, `list_ssh_keys()` |
| `client.catalog`        | `list()`, `deploy(item_id, config)`                                 |
| `client.automation`     | `list()`, `trigger(workflow_id)`                                    |
| `client.queue`          | `list()`                                                             |
| `client.storage`        | `list_partitions()`                                                  |
| `client.network`        | `list_interfaces()`                                                  |
| `client.backups`        | `list()`, `create(config)`, `restore(backup_id)`                    |
| `client.databases`      | `list()`                                                             |
| `client.deployments`    | `list()`                                                             |
| `client.proxy`          | `list()`                                                             |
| `client.health`         | `matrix()`                                                           |

---

## Error Handling

```python
from vpsgui import VpsguiClient, VpsguiApiError

client = VpsguiClient(base_url="https://your-vps-ip/api/v1", token="your-token")

try:
    nodes = client.nodes.list()
except VpsguiApiError as e:
    print(f"API Error {e.status_code}: {e.status_text}")
    print(f"Response body: {e.body}")
```

---

## Advanced: Update Token at Runtime

```python
client.set_token("new-jwt-token")
```

---

## Requirements

- Python >= 3.8
- `requests >= 2.28.0`

---

## License

MIT -- [NotGamerPratham](https://notgamerpratham.com)
