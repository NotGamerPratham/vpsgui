"""
VPSGUI Python SDK Client

Official Python client for the VPSGUI REST API.
Provides typed resource accessors for all VPSGUI API endpoints.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import requests


class VpsguiApiError(Exception):
    """Raised when the VPSGUI API returns a non-2xx response."""

    def __init__(self, status_code: int, status_text: str, body: str):
        self.status_code = status_code
        self.status_text = status_text
        self.body = body
        super().__init__(f"VPSGUI API Error {status_code}: {status_text}")


class VpsguiClient:
    """
    Official VPSGUI Python SDK Client.

    Usage::

        from vpsgui import VpsguiClient

        client = VpsguiClient(
            base_url="https://your-vps-ip/api/v1",
            token="your-jwt-token",
        )

        nodes = client.nodes.list()
        containers = client.docker.list_containers()
        telemetry = client.system.telemetry()

    Args:
        base_url: The VPSGUI API base URL (e.g. ``https://10.0.0.1/api/v1``).
        token: Optional JWT Bearer authentication token.
        timeout: Request timeout in seconds (default: 30).
    """

    def __init__(
        self,
        base_url: str,
        token: Optional[str] = None,
        timeout: int = 30,
    ):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self._session = requests.Session()

        # Resource accessors
        self.nodes = _NodesResource(self)
        self.docker = _DockerResource(self)
        self.system = _SystemResource(self)
        self.files = _FilesResource(self)
        self.security = _SecurityResource(self)
        self.catalog = _CatalogResource(self)
        self.automation = _AutomationResource(self)
        self.queue = _QueueResource(self)
        self.storage = _StorageResource(self)
        self.network = _NetworkResource(self)
        self.backups = _BackupsResource(self)
        self.databases = _DatabasesResource(self)
        self.deployments = _DeploymentsResource(self)
        self.proxy = _ProxyResource(self)
        self.health = _HealthResource(self)

    def set_token(self, token: str) -> None:
        """Update the auth token at runtime."""
        self.token = token

    def request(
        self,
        method: str,
        path: str,
        json_body: Optional[Any] = None,
        params: Optional[Dict[str, str]] = None,
    ) -> Any:
        """
        Internal HTTP request wrapper with auth headers and error handling.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE).
            path: API path relative to base_url (e.g. ``/nodes``).
            json_body: Optional JSON request body.
            params: Optional query parameters.

        Returns:
            Parsed JSON response.

        Raises:
            VpsguiApiError: If the API returns a non-2xx status code.
        """
        url = f"{self.base_url}{path}"
        headers: Dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        response = self._session.request(
            method=method,
            url=url,
            headers=headers,
            json=json_body,
            params=params,
            timeout=self.timeout,
        )

        if not response.ok:
            raise VpsguiApiError(
                status_code=response.status_code,
                status_text=response.reason or "",
                body=response.text,
            )

        if response.status_code == 204:
            return None

        return response.json()


# ─── Resource Classes ─────────────────────────────────────────


class _NodesResource:
    """Manage VPS nodes."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """List all connected VPS nodes."""
        return self._client.request("GET", "/nodes")

    def get(self, node_id: str) -> Dict[str, Any]:
        """Get a single node by ID."""
        return self._client.request("GET", f"/nodes/{node_id}")

    def create(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Register a new node."""
        return self._client.request("POST", "/nodes", json_body=payload)

    def delete(self, node_id: str) -> None:
        """Delete a node by ID."""
        self._client.request("DELETE", f"/nodes/{node_id}")

    def reboot(self, node_id: str) -> None:
        """Reboot a node."""
        self._client.request("POST", f"/nodes/{node_id}/reboot")


class _DockerResource:
    """Manage Docker containers and images."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list_containers(self) -> List[Dict[str, Any]]:
        """List all Docker containers on the host."""
        return self._client.request("GET", "/docker/containers")

    def list_images(self) -> List[Dict[str, Any]]:
        """List all Docker images on the host."""
        return self._client.request("GET", "/docker/images")

    def start_container(self, container_id: str) -> None:
        """Start a container by ID."""
        self._client.request("POST", f"/docker/containers/{container_id}/start")

    def stop_container(self, container_id: str) -> None:
        """Stop a container by ID."""
        self._client.request("POST", f"/docker/containers/{container_id}/stop")

    def restart_container(self, container_id: str) -> None:
        """Restart a container by ID."""
        self._client.request("POST", f"/docker/containers/{container_id}/restart")

    def delete_container(self, container_id: str) -> None:
        """Delete a container by ID."""
        self._client.request("DELETE", f"/docker/containers/{container_id}")

    def container_logs(self, container_id: str, lines: int = 100) -> str:
        """Fetch logs from a container."""
        return self._client.request(
            "GET",
            f"/docker/containers/{container_id}/logs",
            params={"lines": str(lines)},
        )


class _SystemResource:
    """System telemetry and process monitoring."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def telemetry(self) -> List[Dict[str, Any]]:
        """Get recent system telemetry data points."""
        return self._client.request("GET", "/system/telemetry")

    def processes(self) -> List[Dict[str, Any]]:
        """Get top running processes."""
        return self._client.request("GET", "/system/processes")


class _FilesResource:
    """VPS file system browser."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list(self, path: str = "/etc") -> List[Dict[str, Any]]:
        """List files in a directory."""
        return self._client.request("GET", "/files", params={"path": path})

    def read(self, file_path: str) -> Dict[str, Any]:
        """Read a file's content."""
        return self._client.request("GET", "/files/read", params={"path": file_path})


class _SecurityResource:
    """Firewall, secrets, audit logs, and SSH keys."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list_firewall_rules(self) -> List[Dict[str, Any]]:
        """List firewall rules."""
        return self._client.request("GET", "/security/firewall")

    def list_secrets(self) -> List[Dict[str, Any]]:
        """List encrypted secrets."""
        return self._client.request("GET", "/security/secrets")

    def list_audit_logs(self) -> List[Dict[str, Any]]:
        """List audit log events."""
        return self._client.request("GET", "/security/audit-logs")

    def list_ssh_keys(self) -> List[Dict[str, Any]]:
        """List SSH keys."""
        return self._client.request("GET", "/security/ssh-keys")


class _CatalogResource:
    """Open infrastructure catalog."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """List available catalog items (apps, stacks, templates)."""
        return self._client.request("GET", "/catalog")

    def deploy(self, item_id: str, config: Optional[Dict[str, Any]] = None) -> None:
        """Deploy a catalog item by ID."""
        self._client.request("POST", f"/catalog/{item_id}/deploy", json_body=config)


class _AutomationResource:
    """Automation workflows."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """List automation workflows."""
        return self._client.request("GET", "/automation/workflows")

    def trigger(self, workflow_id: str) -> None:
        """Trigger a workflow by ID."""
        self._client.request("POST", f"/automation/workflows/{workflow_id}/run")


class _QueueResource:
    """Background job queue."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """List background job queue entries."""
        return self._client.request("GET", "/queue/jobs")


class _StorageResource:
    """Disk partitions and storage."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list_partitions(self) -> List[Dict[str, Any]]:
        """List disk partitions and usage."""
        return self._client.request("GET", "/storage/partitions")


class _NetworkResource:
    """Network interfaces."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list_interfaces(self) -> List[Dict[str, Any]]:
        """List network interfaces."""
        return self._client.request("GET", "/network/interfaces")


class _BackupsResource:
    """Volume snapshots and backups."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """List backup snapshots."""
        return self._client.request("GET", "/backups")

    def create(self, config: Optional[Dict[str, Any]] = None) -> None:
        """Trigger a new backup."""
        self._client.request("POST", "/backups", json_body=config)

    def restore(self, backup_id: str) -> None:
        """Restore from a backup."""
        self._client.request("POST", f"/backups/{backup_id}/restore")


class _DatabasesResource:
    """Database instances."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """List database instances."""
        return self._client.request("GET", "/databases")


class _DeploymentsResource:
    """Git deployments and pipelines."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """List deployment history."""
        return self._client.request("GET", "/deployments")


class _ProxyResource:
    """Reverse proxy rules."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """List reverse proxy rules."""
        return self._client.request("GET", "/proxy/rules")


class _HealthResource:
    """Infrastructure health matrix."""

    def __init__(self, client: VpsguiClient):
        self._client = client

    def matrix(self) -> List[Dict[str, Any]]:
        """Get infrastructure health matrix."""
        return self._client.request("GET", "/health/matrix")
