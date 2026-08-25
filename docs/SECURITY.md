# Security Model

## Threat model in one sentence

The `vpsgui-agent` daemon can execute arbitrary shell commands, install packages, control systemd
units and Docker containers, and read and write files on the host - so **the agent token is
equivalent to a root password**, and anyone who can reach the agent with that token owns the machine.

## What actually protects the deployment

There is exactly one authentication control in VPSGUI: the **agent token**.

| Control | Status | Notes |
| :--- | :--- | :--- |
| Agent bearer token | **Enforced** | Verified by the agent on every endpoint except `/health`. Constant-time comparison; 10 failed attempts locks an IP out for 5 minutes. |
| Loopback binding | **Default** | The agent binds `127.0.0.1` unless `AGENT_HOST` is changed. Reach it through the nginx reverse proxy. |
| File-root confinement | **Opt-in** | File access is restricted to `AGENT_FILE_ROOTS`, resolved through `realpath` so symlinks cannot escape. **Defaults to `/`** - the whole filesystem - because this is a host administration tool. Narrow it to get any confinement benefit. |
| Credential-file deny list | **Enforced** | `shadow`, `gshadow`, `sudoers`, SSH private keys, `*.pem`/`*.key`, and the agent's own token file are refused even inside an allowed root. Override with `AGENT_ALLOW_SENSITIVE_FILES=1`. |
| Input validation | **Enforced** | Package names, container ids, service names, and action verbs are validated against strict patterns. Child processes are spawned with `execFile` (no shell) except the explicit Terminal endpoint. |
| Request body limits | **Enforced** | 8 MiB for file writes, 64 KiB for commands; oversized bodies get a 413. |
| CORS | **Deny by default** | Cross-origin requests are refused unless the origin is listed in `AGENT_ALLOWED_ORIGINS`. |
| Shell execution kill switch | **Available** | `AGENT_ENABLE_SHELL=0` disables `/terminal/exec` entirely. |
| TLS | **Your responsibility** | Not configured by default. See below. |

## What does NOT exist

Be explicit about this, because earlier revisions of this document claimed otherwise:

- **There is no RBAC.** No roles, permissions, or per-user access control are implemented or
  enforced anywhere in the codebase. A `role` field exists on the local profile object and is never
  checked. Do not rely on it.
- **There is no user authentication.** The login page creates a local browser profile and checks no
  password. It keeps a casual visitor off the dashboard routes; it is not a security boundary and
  can be bypassed from browser devtools in seconds.
- **There is no MFA, SSO, or session management.**
- **There is no audit log.** The audit page renders whatever the agent returns from an endpoint the
  agent does not implement, so it is always empty.

If you need multi-user access control, put it in front of VPSGUI - nginx `auth_basic`, an
authenticating proxy (oauth2-proxy, Authelia, Cloudflare Access), or a VPN.

## Deployment requirements

1. **Serve over HTTPS.** The agent token is sent as a bearer header on every request. Over plain
   HTTP anything on the network path can read it and take over the host.
   ```bash
   certbot --nginx -d your-domain.example
   ```
2. **Do not expose the agent port directly.** Keep `AGENT_HOST=127.0.0.1` and let nginx proxy it.
   Firewall port 46509 from the outside regardless.
3. **Restrict who can reach the web UI.** A VPN, an nginx `allow`/`deny` block, or an
   authenticating proxy - the token is the only thing between the open internet and a root shell.
4. **Consider narrowing the file roots.** `AGENT_FILE_ROOTS` **defaults to `/`**, so the file
   manager can read, write, and delete anywhere on the host - including `/etc`, `/boot`, and
   `/var/lib`. That is deliberate for a host administration tool, but it means the file browser has
   no confinement unless you set one:
   ```bash
   sudo AGENT_FILE_ROOTS=/etc,/var/www,/home,/opt,/srv ./run.sh
   ```
   The credential deny list applies at **any** setting, including `/`: `shadow`, `gshadow`,
   `sudoers`, SSH private keys, `*.pem`/`*.key`, and the agent's own `agent.env`, `.agent-token`,
   `.secrets.json` and `.secrets-key` are never served or overwritten.
5. **Disable shell execution if unused.** Set `AGENT_ENABLE_SHELL=0`.
6. **Protect the token at rest.** The token and all agent settings live in
   `/opt/vpsgui/agent/agent.env` at mode `0600`. Stored secrets are encrypted with AES-256-GCM using
   the key in `.secrets-key` (also `0600`) - that keeps values out of the store, backups and logs,
   but not away from root on this host, which holds the key. If the token leaks, delete it from
   `agent.env` and re-run the installer to issue a new one.

## Token handling in the browser

The token is stored in `localStorage` so it survives reloads. Consequences worth knowing:

- Any XSS in the app can read it. The bundled CSP disallows inline scripts to reduce that risk.
- It is cleared on sign-out, so a shared browser does not hand the next person root access.
- API responses are sent with `no-store` and the service worker never caches `/api/*`, so host
  telemetry and file contents are not written to disk by the browser.

## Reporting security vulnerabilities

Do not open a public issue for anything that would let an unauthenticated caller reach the agent.

**Use [GitHub private vulnerability reporting][advisory]** — it delivers straight to the maintainer,
keeps the report private until a fix ships, and needs no working mailbox on our side.

[advisory]: https://github.com/NotGamerPratham/vpsgui/security/advisories/new

> The address `security@vpsgui.dev` was previously listed here. `vpsgui.dev` currently has no DNS
> record, so mail to it **bounces** — do not rely on it. If that domain is set up later and given an
> MX record, it can be restored as a second route; until then the advisory link above is the only
> one that actually reaches anyone.

Please include the agent version (`GET /api/v1/agent/info`), how the agent is exposed (loopback
behind nginx, or bound to a public interface), and whether `AGENT_ENABLE_SHELL` and
`AGENT_FILE_ROOTS` are at their defaults. Never include a real agent token in the report.
