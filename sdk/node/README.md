# vpsgui-sdk

Official Node.js / TypeScript SDK for the [VPSGUI](https://github.com/NotGamerPratham/vpsgui) agent
REST API.

## Install

```bash
npm install vpsgui-sdk
```

Requires Node.js 18+ (uses the built-in `fetch`).

## ⚠️ The agent token is a root password

Every endpoint except `health()` requires the agent token, and that token grants **root-equivalent
control of the host**: shell execution, package installs, and filesystem read/write. Read it from
the environment, never commit it, and only talk to the agent over HTTPS — it travels in the
`Authorization` header.

## Usage

```ts
import { VpsguiClient } from 'vpsgui-sdk';

const client = new VpsguiClient({
  baseUrl: 'https://vps.example.com/api/v1',
  token: process.env.VPSGUI_AGENT_TOKEN,
});

const telemetry = await client.system.telemetry();
console.log(`CPU ${telemetry.cpuPercent}% across ${telemetry.cpuCores} cores`);

for (const c of await client.docker.listContainers()) {
  console.log(c.name, c.state, c.image);
}
```

## API

| Resource | Methods |
| :--- | :--- |
| `client.nodes` | `get()`, `list()`, `topology()`, `health()` |
| `client.system` | `telemetry()`, `processes()`, `services()`, `serviceAction(name, action)`, `packages()`, `installPackage(name)`, `users()` |
| `client.docker` | `listContainers()`, `listImages()`, `containerAction(id, action)`, `removeImage(id, force?)` |
| `client.files` | `list(path)`, `read(path)`, `write(path, content)`, `mkdir(path)`, `delete(path, recursive?)`, `rename(from, to)` |
| `client.security` | `firewallRules()`, `applyFirewallRule(input)`, `sshKeys()`, `auditLogs()`, `listSecrets()`, `saveSecret(input)`, `deleteSecret(name)`, `revealSecret(name)` |
| `client.network` | `interfaces()`, `ipInfo(ip?)` |
| `client.storage` | `partitions()` |
| `client.backups` | `list()`, `create(sourcePath, label?)`, `delete(name)`, `restore(name, destination)` |
| `client.deployments` | `list()`, `pull(path)` |
| `client.catalog` | `list()` |
| `client.automation` | `workflows()` |
| `client.queue` | `jobs()` |
| `client.databases` | `list()` |
| `client.proxy` | `rules()` |
| `client.terminal` | `exec(command)` |
| top level | `health()`, `info()` |

## Errors

```ts
import { VpsguiClient, VpsguiError } from 'vpsgui-sdk';

try {
  await client.system.telemetry();
} catch (error) {
  if (error instanceof VpsguiError) {
    // status is 0 for transport failures (timeout, DNS, connection refused).
    console.error(error.status, error.endpoint, error.message);
    if (error.isAuthError) console.error('Bad token, or locked out after repeated failures.');
  }
}
```

## Nulls are deliberate

Fields the agent cannot determine are `null` rather than guessed. Check before formatting:

- `smartHealth` — needs `smartctl` and raw device access
- `cpuPercent` on a process — Windows `tasklist` reports none
- `city` / `region` from `ipInfo()` — ipinfo's `/lite` tier is country-level
- `size` / `tables` / `keys` on a database — would need per-engine credentials
- `downloadsCount` / `rating` on a catalog item — the agent queries no registry

`read()` also returns `truncated: true` and `editable: false` for a file that exceeded the read cap.
**Do not write that content back** — it would truncate the file on disk.

## License

MIT © [NotGamerPratham](https://notgamerpratham.com)
