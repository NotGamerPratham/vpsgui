# vpsgui

Official Python SDK for the [VPSGUI](https://github.com/NotGamerPratham/vpsgui) agent REST API.

## Install

```bash
pip install vpsgui
```

Requires Python 3.8+.

## The agent token is a root password

Every endpoint except `health()` requires the agent token, and that token grants **root-equivalent
control of the host**: shell execution, package installs, and filesystem read/write. Read it from
the environment, never commit it, and only talk to the agent over HTTPS - it travels in the
`Authorization` header.

## Usage

```python
import os
from vpsgui import VpsguiClient

with VpsguiClient(
    base_url="https://vps.example.com/api/v1",
    token=os.environ["VPSGUI_AGENT_TOKEN"],
) as client:
    telemetry = client.system.telemetry()
    print(f"CPU {telemetry['cpuPercent']}% across {telemetry['cpuCores']} cores")

    for container in client.docker.list_containers():
        print(container["name"], container["state"], container["image"])
```

## API

| Resource | Methods |
| :--- | :--- |
| `client.nodes` | `get()`, `list()`, `topology()`, `health()` |
| `client.system` | `telemetry()`, `processes()`, `services()`, `service_action(name, action)`, `packages()`, `install_package(name)`, `users()` |
| `client.docker` | `list_containers()`, `list_images()`, `container_action(id, action)`, `remove_image(id, force=False)` |
| `client.files` | `list(path)`, `read(path)`, `write(path, content)`, `mkdir(path)`, `delete(path, recursive=False)`, `rename(src, dst)` |
| `client.security` | `firewall_rules()`, `apply_firewall_rule(...)`, `ssh_keys()`, `audit_logs()`, `list_secrets()`, `save_secret(...)`, `delete_secret(name)`, `reveal_secret(name)` |
| `client.network` | `interfaces()`, `ip_info(ip=None)` |
| `client.storage` | `partitions()` |
| `client.backups` | `list()`, `create(source_path, label=None)`, `delete(name)`, `restore(name, destination)` |
| `client.deployments` | `list()`, `pull(path)` |
| `client.catalog` | `list()` |
| `client.automation` | `workflows()` |
| `client.queue` | `jobs()` |
| `client.databases` | `list()` |
| `client.proxy` | `rules()` |
| `client.terminal` | `exec(command)` |
| top level | `health()`, `info()`, `close()` |

## Errors

```python
from vpsgui import VpsguiClient, VpsguiError

try:
    client.system.telemetry()
except VpsguiError as e:
    # status is 0 for transport failures (timeout, DNS, connection refused).
    print(e.status, e.endpoint, e.message)
    if e.is_auth_error:
        print("Bad token, or locked out after repeated failures.")
```

## `None` values are deliberate

Fields the agent cannot determine are `None` rather than guessed. Check before formatting:

- `smartHealth` - needs `smartctl` and raw device access
- `cpuPercent` on a process - Windows `tasklist` reports none
- `city` / `region` from `ip_info()` - ipinfo's `/lite` tier is country-level
- `size` / `tables` / `keys` on a database - would need per-engine credentials
- `downloadsCount` / `rating` on a catalog item - the agent queries no registry

`read()` also returns `truncated: True` and `editable: False` for a file that exceeded the read cap.
**Do not write that content back** - it would truncate the file on disk.

## License

MIT © [NotGamerPratham](https://notgamerpratham.com)
