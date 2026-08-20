"""Official Python SDK for the VPSGUI agent REST API.

Every endpoint except :meth:`VpsguiClient.health` requires the agent token, which grants
root-equivalent control of the host. Treat it as a root password: read it from the environment,
never commit it.

Fields the agent cannot determine come back as ``None`` rather than a plausible-looking guess —
for example SMART verdicts (which need ``smartctl``), per-process CPU on Windows, and city/region
from ipinfo's country-level ``/lite`` tier.

Example
-------
>>> import os
>>> from vpsgui import VpsguiClient
>>> client = VpsguiClient(
...     base_url="https://vps.example.com/api/v1",
...     token=os.environ["VPSGUI_AGENT_TOKEN"],
... )
>>> client.system.telemetry()["cpuPercent"]
12
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from urllib.parse import quote

import requests

__all__ = ["VpsguiClient", "VpsguiError"]


class VpsguiError(Exception):
    """Raised when the agent returns a non-2xx response, or the request never completed.

    ``status`` is 0 for transport-level failures (timeout, DNS, connection refused).
    """

    def __init__(self, message: str, status: int, endpoint: str) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.endpoint = endpoint

    @property
    def is_auth_error(self) -> bool:
        """True when the token is missing, wrong, or temporarily locked out (429)."""
        return self.status in (401, 403, 429)

    def __str__(self) -> str:
        return f"[{self.status}] {self.endpoint}: {self.message}"


class VpsguiClient:
    """Client for a single VPSGUI agent.

    Parameters
    ----------
    base_url:
        Root of the API, e.g. ``https://vps.example.com/api/v1``.
    token:
        Agent token. Required for every endpoint except :meth:`health`.
    timeout:
        Default per-request timeout in seconds.
    verify:
        Passed to ``requests``. Leave at ``True``; disabling TLS verification defeats the point of
        serving the agent over HTTPS, since the token travels in the Authorization header.
    """

    def __init__(
        self,
        base_url: str,
        token: Optional[str] = None,
        timeout: float = 15.0,
        verify: bool = True,
    ) -> None:
        if not base_url:
            raise ValueError("base_url is required")

        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self._session = requests.Session()
        self._session.verify = verify

        self.nodes = _Nodes(self)
        self.system = _System(self)
        self.docker = _Docker(self)
        self.files = _Files(self)
        self.security = _Security(self)
        self.network = _Network(self)
        self.storage = _Storage(self)
        self.backups = _Backups(self)
        self.deployments = _Deployments(self)
        self.catalog = _Catalog(self)
        self.automation = _Automation(self)
        self.queue = _Queue(self)
        self.databases = _Databases(self)
        self.proxy = _Proxy(self)
        self.terminal = _Terminal(self)

    # -- plumbing ---------------------------------------------------------

    def request(
        self,
        method: str,
        endpoint: str,
        json_body: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None,
    ) -> Any:
        """Issue a request and return the decoded body. Raises :class:`VpsguiError` on failure."""
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        try:
            response = self._session.request(
                method,
                f"{self.base_url}{endpoint}",
                json=json_body,
                headers=headers,
                timeout=timeout or self.timeout,
            )
        except requests.Timeout as exc:
            raise VpsguiError(f"Request timed out after {timeout or self.timeout}s", 0, endpoint) from exc
        except requests.RequestException as exc:
            raise VpsguiError(str(exc), 0, endpoint) from exc

        if response.status_code == 204 or not response.content:
            return None

        try:
            payload = response.json()
        except ValueError:
            payload = None

        if not response.ok:
            detail = (
                payload["error"]
                if isinstance(payload, dict) and "error" in payload
                else f"HTTP {response.status_code} {response.reason}"
            )
            raise VpsguiError(str(detail), response.status_code, endpoint)

        return payload

    def close(self) -> None:
        """Close the underlying HTTP session."""
        self._session.close()

    def __enter__(self) -> "VpsguiClient":
        return self

    def __exit__(self, *exc_info: Any) -> None:
        self.close()

    # -- top level --------------------------------------------------------

    def health(self) -> Dict[str, Any]:
        """Liveness probe. The only endpoint that does not require a token."""
        return self.request("GET", "/health")

    def info(self) -> Dict[str, Any]:
        """Agent version, file roots, and which optional integrations are configured."""
        return self.request("GET", "/agent/info")


class _Resource:
    def __init__(self, client: VpsguiClient) -> None:
        self._c = client


class _Nodes(_Resource):
    def get(self) -> Dict[str, Any]:
        """The host this agent runs on."""
        return self._c.request("GET", "/node")

    def list(self) -> List[Dict[str, Any]]:
        """VPSGUI manages a single host, so this always returns exactly one entry."""
        return self._c.request("GET", "/nodes")

    def topology(self) -> List[Dict[str, Any]]:
        """Derived topology: the host, its containers, and detected database engines."""
        return self._c.request("GET", "/topology")

    def health(self) -> List[Dict[str, Any]]:
        """Computed health checks (memory, disk, load, failed units, Docker)."""
        return self._c.request("GET", "/health/matrix")


class _System(_Resource):
    def telemetry(self) -> Dict[str, Any]:
        return self._c.request("GET", "/system/telemetry")

    def processes(self) -> List[Dict[str, Any]]:
        return self._c.request("GET", "/system/processes")

    def services(self) -> List[Dict[str, Any]]:
        return self._c.request("GET", "/system/services")

    def service_action(self, name: str, action: str) -> Dict[str, Any]:
        """Run ``systemctl <action> <name>``. Action is start, stop, restart, or reload."""
        return self._c.request("POST", "/system/services/action", {"name": name, "action": action}, timeout=60)

    def packages(self) -> Dict[str, Any]:
        """Installed packages and language runtimes, probed from PATH."""
        return self._c.request("GET", "/system/packages")

    def install_package(self, package_name: str) -> Dict[str, Any]:
        """Run ``apt-get install -y <package_name>``. Can take several minutes."""
        return self._c.request("POST", "/system/packages/install", {"packageName": package_name}, timeout=300)

    def users(self) -> List[Dict[str, Any]]:
        """Host accounts from /etc/passwd."""
        return self._c.request("GET", "/users")


class _Docker(_Resource):
    def list_containers(self) -> List[Dict[str, Any]]:
        return self._c.request("GET", "/docker/containers")

    def list_images(self) -> List[Dict[str, Any]]:
        return self._c.request("GET", "/docker/images")

    def container_action(self, container_id: str, action: str) -> Dict[str, Any]:
        """Action is start, stop, restart, or remove."""
        return self._c.request(
            "POST", "/docker/containers/action", {"id": container_id, "action": action}, timeout=60
        )

    def remove_image(self, image_id: str, force: bool = False) -> Dict[str, Any]:
        """Run ``docker rmi``. Without ``force`` Docker refuses while a container references it."""
        return self._c.request(
            "POST", "/docker/images/action", {"id": image_id, "action": "remove", "force": force}, timeout=60
        )


class _Files(_Resource):
    def list(self, path: str) -> List[Dict[str, Any]]:
        """Directory entries. Contents are NOT included - use :meth:`read`."""
        return self._c.request("GET", f"/files?path={quote(path, safe='')}")

    def read(self, path: str) -> Dict[str, Any]:
        """Full contents. ``truncated`` is True when the file exceeded the agent's read cap."""
        return self._c.request("GET", f"/files/read?path={quote(path, safe='')}")

    def write(self, path: str, content: str) -> Dict[str, Any]:
        return self._c.request("POST", "/files/write", {"path": path, "content": content})

    def mkdir(self, path: str) -> Dict[str, Any]:
        return self._c.request("POST", "/files/mkdir", {"path": path})

    def delete(self, path: str, recursive: bool = False) -> Dict[str, Any]:
        """Without ``recursive`` the agent refuses to remove a non-empty directory."""
        return self._c.request("POST", "/files/delete", {"path": path, "recursive": recursive})

    def rename(self, source: str, destination: str) -> Dict[str, Any]:
        return self._c.request("POST", "/files/rename", {"from": source, "to": destination})


class _Security(_Resource):
    def firewall_rules(self) -> List[Dict[str, Any]]:
        return self._c.request("GET", "/security/firewall")

    def apply_firewall_rule(
        self,
        action: str,
        port: Optional[str] = None,
        protocol: str = "tcp",
        source: str = "any",
        rule_number: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Apply a ufw change.

        ``action`` is allow, deny, reject, limit, or delete. ``delete`` takes ``rule_number``
        (the index shown by ``ufw status numbered``); the others take ``port``.
        """
        body: Dict[str, Any] = {"action": action}
        if rule_number is not None:
            body["ruleNumber"] = rule_number
        else:
            body.update({"port": port, "protocol": protocol, "source": source})
        return self._c.request("POST", "/security/firewall/action", body, timeout=30)

    def ssh_keys(self) -> List[Dict[str, Any]]:
        """Public keys from authorized_keys. Private keys are never served."""
        return self._c.request("GET", "/security/ssh-keys")

    def audit_logs(self) -> List[Dict[str, Any]]:
        """SSH and sudo events from the host journal."""
        return self._c.request("GET", "/security/audit-logs")

    def list_secrets(self) -> List[Dict[str, Any]]:
        """Metadata only - values are never returned here. Use :meth:`reveal_secret`."""
        return self._c.request("GET", "/security/secrets")

    def save_secret(
        self, name: str, value: str, environment: str = "production", type_: str = "env"
    ) -> Dict[str, Any]:
        """Create or overwrite a secret. The agent encrypts the value before it touches disk."""
        return self._c.request(
            "POST", "/security/secrets", {"name": name, "value": value, "environment": environment, "type": type_}
        )

    def delete_secret(self, name: str) -> Dict[str, Any]:
        return self._c.request("POST", "/security/secrets/delete", {"name": name})

    def reveal_secret(self, name: str) -> Dict[str, Any]:
        """Decrypt one secret. Separate by design so values are never fetched in bulk."""
        return self._c.request("POST", "/security/secrets/reveal", {"name": name})


class _Network(_Resource):
    def interfaces(self) -> List[Dict[str, Any]]:
        return self._c.request("GET", "/network/interfaces")

    def ip_info(self, ip: Optional[str] = None) -> Dict[str, Any]:
        """Geolocate an address. Omit ``ip`` to look up the host's own public address."""
        suffix = f"?ip={quote(ip, safe='')}" if ip else ""
        return self._c.request("GET", f"/network/ip-info{suffix}")


class _Storage(_Resource):
    def partitions(self) -> List[Dict[str, Any]]:
        """Mounted filesystems from ``df``. Pseudo-filesystems are excluded."""
        return self._c.request("GET", "/storage/partitions")


class _Backups(_Resource):
    def list(self) -> List[Dict[str, Any]]:
        return self._c.request("GET", "/backups")

    def create(self, source_path: str, label: Optional[str] = None) -> Dict[str, Any]:
        """Create a tar.gz of ``source_path``. Large trees can take minutes."""
        return self._c.request(
            "POST", "/backups/create", {"sourcePath": source_path, "label": label}, timeout=600
        )

    def delete(self, name: str) -> Dict[str, Any]:
        return self._c.request("POST", "/backups/delete", {"name": name})

    def restore(self, name: str, destination: str) -> Dict[str, Any]:
        """Extract an archive into ``destination``. Existing files may be overwritten."""
        return self._c.request(
            "POST", "/backups/restore", {"name": name, "destination": destination}, timeout=600
        )


class _Deployments(_Resource):
    def list(self) -> List[Dict[str, Any]]:
        """Git checkouts found on the host."""
        return self._c.request("GET", "/deployments", timeout=30)

    def pull(self, path: str) -> Dict[str, Any]:
        """Run ``git pull --ff-only``. Accepted only for a path :meth:`list` already reported."""
        return self._c.request("POST", "/deployments/pull", {"path": path}, timeout=120)


class _Catalog(_Resource):
    def list(self) -> List[Dict[str, Any]]:
        """Curated, installable applications. Reference data, not host state."""
        return self._c.request("GET", "/catalog")


class _Automation(_Resource):
    def workflows(self) -> List[Dict[str, Any]]:
        """cron entries from /etc/crontab, /etc/cron.d and root's crontab."""
        return self._c.request("GET", "/automation/workflows")


class _Queue(_Resource):
    def jobs(self) -> List[Dict[str, Any]]:
        """systemd timers."""
        return self._c.request("GET", "/queue/jobs")


class _Databases(_Resource):
    def list(self) -> List[Dict[str, Any]]:
        """Engines detected from listening TCP ports."""
        return self._c.request("GET", "/databases")


class _Proxy(_Resource):
    def rules(self) -> List[Dict[str, Any]]:
        """Reverse-proxy rules parsed from the live nginx configuration."""
        return self._c.request("GET", "/proxy/rules")


class _Terminal(_Resource):
    def exec(self, command: str) -> Dict[str, Any]:
        """Run a shell command on the host.

        This is arbitrary remote code execution by design, gated by the agent token. It can be
        disabled server-side with ``AGENT_ENABLE_SHELL=0``, in which case the agent returns 403.
        """
        return self._c.request("POST", "/terminal/exec", {"command": command}, timeout=20)
