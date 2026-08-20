"""On-disk credentials for the ``vpsgui`` command.

The format is shared verbatim with the Node SDK, because ``npm i -g vpsgui`` and
``pip install vpsgui`` both put a ``vpsgui`` executable on PATH and only one of
them can win. Sharing the file means it does not matter which one does:
whichever binary runs, ``vpsgui login`` and every other command see the same
profiles. Any change here has to land in sdk/node/src/config.ts too.
"""

from __future__ import annotations

import json
import os
import re
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

__all__ = [
    "CONFIG_VERSION",
    "config_dir",
    "config_path",
    "read_config",
    "write_config",
    "resolve_profile_name",
    "load_credentials",
    "normalise_url",
    "utc_now",
]

CONFIG_VERSION = 1


def utc_now() -> str:
    """An ISO-8601 timestamp the Node SDK will also produce and parse."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def config_dir() -> Path:
    # VPSGUI_CONFIG_DIR exists so CI and tests never touch a real operator's
    # credentials.
    override = os.environ.get("VPSGUI_CONFIG_DIR")
    if override:
        return Path(override)
    return Path.home() / ".vpsgui"


def config_path() -> Path:
    return config_dir() / "config.json"


def _empty() -> Dict[str, Any]:
    return {"version": CONFIG_VERSION, "current": "default", "profiles": {}}


def read_config() -> Dict[str, Any]:
    path = config_path()
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        # The normal state before the first login.
        return _empty()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"{path} is not valid JSON ({exc.msg}). Fix or delete it, then run: vpsgui login"
        ) from exc

    if not isinstance(parsed, dict):
        raise RuntimeError(f"{path} does not contain a config object. Delete it and run: vpsgui login")

    profiles = parsed.get("profiles")
    return {
        "version": parsed.get("version", CONFIG_VERSION),
        "current": parsed.get("current") or "default",
        "profiles": profiles if isinstance(profiles, dict) else {},
    }


def write_config(config: Dict[str, Any]) -> None:
    """Write the config with owner-only permissions.

    The mode is set on the temp file before any token reaches the disk; creating
    it 0644 and chmod-ing afterwards would leave a window where any local user
    could read the token.
    """
    directory = config_dir()
    directory.mkdir(parents=True, exist_ok=True)
    try:
        directory.chmod(0o700)
    except (OSError, NotImplementedError):
        pass

    tmp = directory / f".config.json.{os.getpid()}.tmp"
    # os.open with the mode is the only way to create the file already private;
    # Path.write_text would go through the umask first.
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(json.dumps(config, indent=2) + "\n")
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise

    os.replace(str(tmp), str(config_path()))

    # os.replace preserves the temp file's mode, but a config.json written by an
    # older version may still be 0644.
    try:
        os.chmod(str(config_path()), stat.S_IRUSR | stat.S_IWUSR)
    except (OSError, NotImplementedError):
        # Windows and some network filesystems do not implement POSIX modes.
        pass


def resolve_profile_name(config: Dict[str, Any], explicit: Optional[str] = None) -> str:
    """Honour ``--profile``, then VPSGUI_PROFILE, then the last login."""
    return explicit or os.environ.get("VPSGUI_PROFILE") or config.get("current") or "default"


def load_credentials(explicit_profile: Optional[str] = None) -> Optional[Tuple[str, str, str]]:
    """``(url, token, source)`` for a command, or ``None`` when nothing is configured.

    The environment wins over the config file so CI can run without a login step,
    and so an operator can override a saved profile for one command.
    """
    env_url = os.environ.get("VPSGUI_API_URL")
    env_token = os.environ.get("VPSGUI_AGENT_TOKEN")
    if env_url and env_token:
        return env_url, env_token, "environment"

    config = read_config()
    name = resolve_profile_name(config, explicit_profile)
    profile = config["profiles"].get(name)
    if not isinstance(profile, dict):
        return None

    url = profile.get("url")
    token = profile.get("token")
    if not url or not token:
        return None

    return url, token, f'profile "{name}"'


_SCHEME = re.compile(r"^https?://", re.IGNORECASE)
_IPV4 = re.compile(r"^\d+\.\d+\.\d+\.\d+$")


def normalise_url(raw: str) -> str:
    """Turn what an operator types into an API root.

    People paste the address bar - ``vps.example.com``, ``http://1.2.3.4:46509``,
    ``https://host/api/v1/`` - and every one of those should work rather than
    producing a 404 they have to debug.
    """
    url = (raw or "").strip()
    if not url:
        raise ValueError("Enter the agent URL.")

    if not _SCHEME.match(url):
        # Bare IPs and localhost are almost always a plain-HTTP agent on the LAN;
        # a hostname typed without a scheme is almost always a public HTTPS one.
        host = url.split("/")[0].split(":")[0]
        local = host in ("localhost", "127.0.0.1") or bool(_IPV4.match(host))
        url = ("http://" if local else "https://") + url

    url = url.rstrip("/")
    if not url.endswith("/api/v1"):
        url += "/api/v1"
    return url


def supports_mode() -> bool:
    """Whether claiming a 0600 file mode would be truthful here."""
    return sys.platform != "win32"
