"""The ``vpsgui`` command.

A deliberately small surface: sign in once, then run the handful of things an
operator wants from a terminal without opening the dashboard. Anything richer
belongs in a script against the SDK, which is what this shares its config with.

Kept behaviour-compatible with the Node CLI in sdk/node/src/cli.ts - same
commands, same flags, same config file - because both packages install a binary
called ``vpsgui`` and only one of them can be first on PATH.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from typing import Any, Dict, List, Optional, Sequence

from vpsgui.client import VpsguiClient, VpsguiError
from vpsgui.config import (
    config_path,
    load_credentials,
    normalise_url,
    read_config,
    resolve_profile_name,
    supports_mode,
    utc_now,
    write_config,
)

VERSION = "1.2.0"

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

# Respect NO_COLOR, and never emit escapes when piped - `vpsgui ps | grep` and
# `vpsgui status > log` should produce plain text.
_USE_COLOR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")
_ESC = chr(27)


def _paint(code: str):
    def apply(text: str) -> str:
        return f"{_ESC}[{code}m{text}{_ESC}[0m" if _USE_COLOR else text

    return apply


bold = _paint("1")
dim = _paint("2")
red = _paint("31")
green = _paint("32")
yellow = _paint("33")
cyan = _paint("36")


def out(line: str = "") -> None:
    print(line)


class CliError(Exception):
    """A message for the operator, with an optional next step."""

    def __init__(self, message: str, hint: Optional[str] = None) -> None:
        super().__init__(message)
        self.message = message
        self.hint = hint


def table(rows: Sequence[Sequence[str]]) -> None:
    if not rows:
        return
    widths = [max(len(str(row[i])) for row in rows) for i in range(len(rows[0]))]
    for index, row in enumerate(rows):
        cells = [
            str(cell) if i == len(row) - 1 else str(cell).ljust(widths[i]) for i, cell in enumerate(row)
        ]
        line = "  ".join(cells)
        out(bold(line) if index == 0 else line)


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


def describe(exc: BaseException) -> CliError:
    """Translate agent failures into something an operator can act on."""
    if isinstance(exc, VpsguiError):
        if exc.status == 401:
            return CliError("The agent rejected the token (401).", "Run: vpsgui login")
        # 403 means two unrelated things. Path confinement is by far the more
        # common one, and telling someone to sign in again when the real problem
        # is that /etc is not a configured root sends them down the wrong path.
        if exc.status == 403:
            if "root" in exc.message.lower():
                return CliError(exc.message, "Run `vpsgui whoami` to see which paths this agent allows.")
            return CliError(f"{exc.message} (403)", "If this is unexpected, run: vpsgui login")
        if exc.status == 429:
            return CliError("Locked out after repeated failed attempts. Wait a few minutes.")
        if exc.status == 404:
            return CliError(
                f"{exc.endpoint} does not exist on this agent (404).",
                "The agent is probably older than this CLI. Re-run the installer on the host: sudo ./run.sh",
            )
        if exc.status == 0:
            return CliError(
                f"Could not reach the agent: {exc.message}",
                "Check the URL, that the agent is running, and that the port is open.",
            )
        return CliError(f"{exc.message} ({exc.status})")
    if isinstance(exc, CliError):
        return exc
    return CliError(str(exc))


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


def connect(args: argparse.Namespace) -> VpsguiClient:
    creds = load_credentials(getattr(args, "profile", None))
    if creds is None:
        raise CliError("Not signed in.", "Run: vpsgui login")
    url, token, _ = creds
    return VpsguiClient(base_url=url, token=token)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def cmd_login(args: argparse.Namespace) -> int:
    """Save credentials for a host, after proving they work.

    Verifying before writing matters: a saved-but-wrong token turns every later
    command into a 401 that looks like the agent is broken, and the operator has
    no way to tell which of the two values they got wrong.
    """
    profile_name = args.profile or "default"

    raw_url = args.url_positional or args.url or input("Agent URL: ").strip()
    url = normalise_url(raw_url)

    # --token exists for automation, but it lands in shell history, so the
    # interactive path stays the default and the docs only show that one.
    token = args.token or os.environ.get("VPSGUI_AGENT_TOKEN") or ""
    if not token:
        out(dim("The agent token is under Settings in the dashboard. It grants root-equivalent control."))
        if sys.stdin.isatty():
            # getpass reads from the tty with echo off, so the token cannot be
            # shoulder-surfed or captured in a screen recording.
            token = getpass.getpass("Agent token: ").strip()
        else:
            token = sys.stdin.readline().strip()
    if not token:
        raise CliError("No token entered.")

    out(dim(f"Verifying {url}..."))
    client = VpsguiClient(base_url=url, token=token)
    info = client.info()

    # Nice-to-have; a host that answers /agent/info but not /node is still usable.
    try:
        hostname = client.nodes.get().get("name")
    except VpsguiError:
        hostname = None

    config = read_config()
    config["profiles"][profile_name] = {
        "url": url,
        "token": token,
        "hostname": hostname,
        "agentVersion": info.get("version"),
        "savedAt": utc_now(),
    }
    config["current"] = profile_name
    write_config(config)

    out()
    out(f"{green('Signed in')} to {bold(hostname or url)}")
    out(f"{dim('agent')}    {info.get('version')} on {info.get('platform')}")
    out(f"{dim('profile')}  {profile_name}")
    # NTFS ignores POSIX modes, so only claim the file is locked down where that
    # is actually true.
    mode_note = dim(" (mode 0600)") if supports_mode() else ""
    out(f"{dim('saved')}    {config_path()}{mode_note}")
    if info.get("shellEnabled") is False:
        out(dim("Shell execution is disabled on this agent, so `vpsgui exec` will not work."))
    return 0


def cmd_logout(args: argparse.Namespace) -> int:
    config = read_config()
    name = resolve_profile_name(config, args.profile)

    if args.all:
        count = len(config["profiles"])
        config["profiles"] = {}
        config["current"] = "default"
        write_config(config)
        out(f"Removed {count} profile{'' if count == 1 else 's'}.")
        return 0

    if name not in config["profiles"]:
        out(f'No profile named "{name}".')
        return 0

    del config["profiles"][name]
    if config["current"] == name:
        remaining = list(config["profiles"])
        config["current"] = remaining[0] if remaining else "default"
    write_config(config)
    out(f'Removed profile "{name}".')
    out(dim("The token is gone from this machine. It is still valid on the host - rotate it there if it leaked."))
    return 0


def cmd_whoami(args: argparse.Namespace) -> int:
    creds = load_credentials(args.profile)
    if creds is None:
        out("Not signed in.")
        out(dim("Run: vpsgui login"))
        return 1

    url, token, source = creds
    out(f"{dim('url')}     {url}")
    out(f"{dim('source')}  {source}")

    client = VpsguiClient(base_url=url, token=token)
    try:
        info = client.info()
        node = client.nodes.get()
    except VpsguiError as exc:
        error = describe(exc)
        out(f"{yellow('Saved, but not working:')} {error.message}")
        if error.hint:
            out(dim(error.hint))
        return 1

    out(f"{dim('host')}    {node.get('name')}")
    out(f"{dim('agent')}   {info.get('version')} on {info.get('platform')}")
    out(f"{dim('roots')}   {', '.join(info.get('fileRoots') or [])}")
    out(green("Token accepted."))
    return 0


def cmd_profiles(args: argparse.Namespace) -> int:
    config = read_config()
    if not config["profiles"]:
        out("No profiles. Run: vpsgui login")
        return 0

    rows: List[List[str]] = [["", "PROFILE", "HOST", "URL", "AGENT"]]
    for name, profile in config["profiles"].items():
        rows.append([
            "*" if name == config["current"] else " ",
            name,
            profile.get("hostname") or "-",
            profile.get("url") or "-",
            profile.get("agentVersion") or "-",
        ])
    table(rows)
    return 0


def cmd_use(args: argparse.Namespace) -> int:
    config = read_config()
    if args.name not in config["profiles"]:
        known = ", ".join(config["profiles"]) or "none"
        raise CliError(f'No profile named "{args.name}".', f"Known: {known}")
    config["current"] = args.name
    write_config(config)
    profile = config["profiles"][args.name]
    out(f'Now using "{args.name}" ({profile.get("hostname") or profile.get("url")}).')
    return 0


def _bar(percent: float) -> str:
    width = 20
    filled = max(0, min(width, round((percent / 100) * width)))
    glyph = "#" * filled + "-" * (width - filled)
    colour = red if percent >= 90 else yellow if percent >= 70 else green
    return colour(glyph)


def cmd_status(args: argparse.Namespace) -> int:
    client = connect(args)
    node = client.nodes.get()
    telemetry = client.system.telemetry()
    health = client.nodes.health()

    os_info: Dict[str, Any] = node.get("os") or {}
    hardware: Dict[str, Any] = node.get("hardware") or {}

    uptime_hours = int((os_info.get("uptimeSeconds") or 0) // 3600)
    uptime = f"{uptime_hours // 24}d {uptime_hours % 24}h" if uptime_hours >= 24 else f"{uptime_hours}h"

    out(bold(str(node.get("name"))))
    out(dim(f"{os_info.get('name')} {os_info.get('version')} - kernel {os_info.get('kernel')} - up {uptime}"))
    out()
    for label, percent, detail in (
        ("cpu  ", telemetry.get("cpuPercent", 0), f"{hardware.get('cpuCores')} cores"),
        ("mem  ", telemetry.get("ramPercent", 0), f"{hardware.get('ramGb')} GB"),
        ("disk ", telemetry.get("diskPercent", 0), f"{hardware.get('diskGb')} GB"),
    ):
        out(f"{label} {_bar(percent)} {str(percent).rjust(3)}%  {dim(detail)}")

    failing = [check for check in health if check.get("status") != "green"]
    if failing:
        out()
        out(bold("Checks needing attention"))
        for check in failing:
            mark = red("x") if check.get("status") == "red" else yellow("!")
            message = check.get("message")
            out(f"  {mark} {check.get('name')}{dim(' - ' + message) if message else ''}")
    return 0


def cmd_health(args: argparse.Namespace) -> int:
    client = connect(args)
    checks = client.nodes.health()
    rows: List[List[str]] = [["", "CHECK", "DETAIL"]]
    for check in checks:
        status = check.get("status")
        mark = green("ok") if status == "green" else red("fail") if status == "red" else yellow("warn")
        rows.append([mark, str(check.get("name")), str(check.get("message") or "")])
    table(rows)
    # A red check is a real problem on the host, so exit non-zero and let a
    # monitoring cron treat `vpsgui health` as a probe.
    return 1 if any(c.get("status") == "red" for c in checks) else 0


def cmd_ps(args: argparse.Namespace) -> int:
    client = connect(args)
    containers = client.docker.list_containers()
    if not containers:
        out("No containers.")
        return 0

    rows: List[List[str]] = [["NAME", "IMAGE", "STATUS", "CPU", "MEM"]]
    for container in containers:
        cpu = container.get("cpuPercent")
        memory = container.get("memoryUsageMb")
        rows.append([
            str(container.get("name")),
            str(container.get("image")),
            str(container.get("status")),
            "-" if cpu is None else f"{cpu}%",
            f"{memory} MB" if memory else "-",
        ])
    table(rows)
    return 0


def cmd_ls(args: argparse.Namespace) -> int:
    client = connect(args)
    items = client.files.list(args.path)
    if not items:
        out(dim("(empty)"))
        return 0

    rows: List[List[str]] = [["TYPE", "SIZE", "MODIFIED", "NAME"]]
    for item in items:
        is_dir = item.get("type") == "directory"
        modified = item.get("modifiedAt")
        rows.append([
            "dir" if is_dir else "file",
            "-" if is_dir else str(item.get("size", "-")),
            str(modified)[:16].replace("T", " ") if modified else "-",
            cyan(str(item.get("name"))) if is_dir else str(item.get("name")),
        ])
    table(rows)
    return 0


def cmd_exec(args: argparse.Namespace) -> int:
    command = " ".join(args.command).strip()
    if not command:
        raise CliError("Nothing to run.", 'Usage: vpsgui exec "systemctl status nginx"')

    client = connect(args)
    result = client.terminal.exec(command)
    output = result.get("output") or ""
    if output:
        sys.stdout.write(output if output.endswith("\n") else output + "\n")
    # Mirror the remote command's disposition, so `vpsgui exec ... && next`
    # behaves the way it would over ssh.
    return 0 if result.get("success") else 1


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="vpsgui",
        description="Control a VPSGUI agent from the terminal.",
        epilog=(
            "Environment: VPSGUI_API_URL and VPSGUI_AGENT_TOKEN use credentials without a saved "
            "profile; VPSGUI_PROFILE sets the default profile; VPSGUI_CONFIG_DIR overrides "
            "~/.vpsgui; NO_COLOR disables colour."
        ),
    )
    parser.add_argument("--version", action="version", version=VERSION)
    sub = parser.add_subparsers(dest="command")

    def add(name: str, help_text: str, handler) -> argparse.ArgumentParser:
        p = sub.add_parser(name, help=help_text)
        p.add_argument("--profile", help="Act on a specific saved host")
        p.set_defaults(handler=handler)
        return p

    login = add("login", "Save credentials for a host, after checking they work", cmd_login)
    login.add_argument("url_positional", nargs="?", metavar="url", help="Agent URL")
    login.add_argument("--url", help="Agent URL")
    login.add_argument("--token", help="Agent token (ends up in shell history)")

    logout = add("logout", "Forget this machine's copy of the token", cmd_logout)
    logout.add_argument("--all", action="store_true", help="Remove every profile")

    add("whoami", "Show the active profile and confirm the agent accepts it", cmd_whoami)
    add("profiles", "List saved hosts", cmd_profiles)

    use = add("use", "Switch the default host", cmd_use)
    use.add_argument("name", help="Profile name")

    add("status", "CPU, memory, disk, and any failing checks", cmd_status)
    add("health", "Every health check, one per line", cmd_health)
    add("ps", "Docker containers", cmd_ps)

    ls = add("ls", "List a directory on the host", cmd_ls)
    ls.add_argument("path", nargs="?", default="/", help="Directory to list (default /)")

    ex = add("exec", "Run a shell command on the host", cmd_exec)
    ex.add_argument("command", nargs=argparse.REMAINDER, help="Command to run")

    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if not getattr(args, "command", None):
        parser.print_help()
        return 0

    try:
        return args.handler(args)
    except KeyboardInterrupt:
        # Ctrl-C at a token prompt is a normal way to back out, not a crash.
        sys.stderr.write("\nCancelled.\n")
        return 130
    except (VpsguiError, CliError, ValueError, RuntimeError, OSError) as exc:
        error = describe(exc)
        sys.stderr.write(f"{red('error')} {error.message}\n")
        if error.hint:
            sys.stderr.write(f"{dim(error.hint)}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
