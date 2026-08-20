"""The CLI config is a contract between two published packages.

``npm i -g vpsgui`` and ``pip install vpsgui`` both install a binary called
``vpsgui``, only one wins on PATH, and both read this file. A drift here means
an operator logs in with one and the other cannot see the profile.

The Node half of the contract is asserted in tests/cliConfig.test.ts against the
same fixture, so the two files are deliberately parallel.
"""

from __future__ import annotations

import json
import os
import stat
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vpsgui.config import (  # noqa: E402
    CONFIG_VERSION,
    config_path,
    load_credentials,
    normalise_url,
    read_config,
    resolve_profile_name,
    write_config,
)

ENV_KEYS = ("VPSGUI_CONFIG_DIR", "VPSGUI_API_URL", "VPSGUI_AGENT_TOKEN", "VPSGUI_PROFILE")


@pytest.fixture(autouse=True)
def isolated_config(tmp_path, monkeypatch):
    for key in ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("VPSGUI_CONFIG_DIR", str(tmp_path))
    return tmp_path


# ---------------------------------------------------------------------------
# normalise_url
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("https://vps.example.com", "https://vps.example.com/api/v1"),
        ("https://vps.example.com/api/v1", "https://vps.example.com/api/v1"),
        ("https://vps.example.com/api/v1/", "https://vps.example.com/api/v1"),
        # An agent on 127.0.0.1 has no certificate; defaulting it to https would
        # make the common local case fail with a TLS error.
        ("127.0.0.1:46509", "http://127.0.0.1:46509/api/v1"),
        ("localhost:46509", "http://localhost:46509/api/v1"),
        ("194.62.248.20:46509", "http://194.62.248.20:46509/api/v1"),
        ("vps.example.com", "https://vps.example.com/api/v1"),
        ("http://vps.example.com", "http://vps.example.com/api/v1"),
    ],
)
def test_normalise_url_matches_the_node_cli(raw, expected):
    assert normalise_url(raw) == expected


def test_normalise_url_rejects_empty():
    with pytest.raises(ValueError):
        normalise_url("   ")


# ---------------------------------------------------------------------------
# read/write
# ---------------------------------------------------------------------------


def test_read_config_before_first_login():
    assert read_config() == {"version": CONFIG_VERSION, "current": "default", "profiles": {}}


def test_read_config_explains_corruption():
    config_path().write_text("{ not json", encoding="utf-8")
    with pytest.raises(RuntimeError, match="not valid JSON"):
        read_config()


def test_read_config_tolerates_missing_fields():
    config_path().write_text(json.dumps({"profiles": None}), encoding="utf-8")
    config = read_config()
    assert config["profiles"] == {}
    assert config["current"] == "default"


def test_write_config_round_trips_the_shared_shape():
    write_config(
        {
            "version": CONFIG_VERSION,
            "current": "prod",
            "profiles": {
                "prod": {
                    "url": "https://vps.example.com/api/v1",
                    "token": "secret-token",
                    "hostname": "vps-1",
                    "agentVersion": "1.6.0",
                    "savedAt": "2026-08-20T12:00:00.000Z",
                }
            },
        }
    )

    on_disk = json.loads(config_path().read_text(encoding="utf-8"))
    assert on_disk == {
        "version": 1,
        "current": "prod",
        "profiles": {
            "prod": {
                "url": "https://vps.example.com/api/v1",
                "token": "secret-token",
                "hostname": "vps-1",
                "agentVersion": "1.6.0",
                "savedAt": "2026-08-20T12:00:00.000Z",
            }
        },
    }


@pytest.mark.skipif(sys.platform == "win32", reason="NTFS does not implement POSIX modes")
def test_write_config_is_owner_only():
    write_config({"version": 1, "current": "a", "profiles": {"a": {"url": "u", "token": "t"}}})
    # The file holds a root-equivalent credential; any other local user being
    # able to read it defeats the point of the agent's own 0600 token file.
    assert stat.S_IMODE(os.stat(config_path()).st_mode) == 0o600


def test_write_config_leaves_no_temp_file(isolated_config):
    write_config({"version": 1, "current": "a", "profiles": {}})
    assert [p.name for p in isolated_config.iterdir() if "tmp" in p.name] == []


# ---------------------------------------------------------------------------
# load_credentials
# ---------------------------------------------------------------------------


def test_load_credentials_returns_none_when_unconfigured():
    assert load_credentials() is None


def test_environment_wins_so_ci_needs_no_login(monkeypatch):
    write_config(
        {
            "version": 1,
            "current": "saved",
            "profiles": {"saved": {"url": "https://saved/api/v1", "token": "saved-token"}},
        }
    )
    monkeypatch.setenv("VPSGUI_API_URL", "https://ci/api/v1")
    monkeypatch.setenv("VPSGUI_AGENT_TOKEN", "ci-token")

    assert load_credentials() == ("https://ci/api/v1", "ci-token", "environment")


def test_half_configured_environment_is_ignored(monkeypatch):
    write_config(
        {
            "version": 1,
            "current": "saved",
            "profiles": {"saved": {"url": "https://saved/api/v1", "token": "saved-token"}},
        }
    )
    monkeypatch.setenv("VPSGUI_API_URL", "https://ci/api/v1")

    creds = load_credentials()
    assert creds is not None and creds[1] == "saved-token"


def test_explicit_profile_beats_current():
    write_config(
        {
            "version": 1,
            "current": "prod",
            "profiles": {
                "prod": {"url": "https://prod/api/v1", "token": "prod-token"},
                "staging": {"url": "https://staging/api/v1", "token": "staging-token"},
            },
        }
    )

    assert load_credentials("staging")[1] == "staging-token"
    assert load_credentials()[1] == "prod-token"


def test_profile_without_token_is_unusable():
    write_config({"version": 1, "current": "broken", "profiles": {"broken": {"url": "u", "token": ""}}})
    assert load_credentials() is None


def test_resolve_profile_precedence(monkeypatch):
    config = {"version": 1, "current": "saved", "profiles": {}}
    monkeypatch.setenv("VPSGUI_PROFILE", "from-env")

    assert resolve_profile_name(config, "from-flag") == "from-flag"
    assert resolve_profile_name(config) == "from-env"

    monkeypatch.delenv("VPSGUI_PROFILE")
    assert resolve_profile_name(config) == "saved"


# ---------------------------------------------------------------------------
# Cross-runtime
# ---------------------------------------------------------------------------


def test_config_written_here_is_readable_by_the_node_cli(isolated_config):
    """A profile saved by `pip`'s vpsgui must be visible to `npm`'s, and vice versa."""
    write_config(
        {
            "version": 1,
            "current": "prod",
            "profiles": {"prod": {"url": "https://vps.example.com/api/v1", "token": "t"}},
        }
    )

    raw = json.loads(config_path().read_text(encoding="utf-8"))
    # These three keys are what sdk/node/src/config.ts reads; renaming any of
    # them silently breaks the other CLI.
    assert set(raw) == {"version", "current", "profiles"}
    assert set(raw["profiles"]["prod"]) <= {
        "url",
        "token",
        "hostname",
        "agentVersion",
        "savedAt",
    }
