# Installing VPSGUI on Linux

VPSGUI ships as native packages and a portable installer, all built from the same tree and all
bundling their own Node.js 22, so the host's Node (old, missing or conflicting) never matters and
is never touched.

| You run | Install with |
|---|---|
| Debian, Ubuntu, Linux Mint, Pop!_OS, Raspberry Pi OS, Kali | [`apt`](#debian-and-ubuntu-apt) |
| Rocky, AlmaLinux, RHEL, CentOS Stream, Fedora | [`dnf`](#rhel-rocky-alma-fedora-dnf) |
| Anything else with systemd and glibc (openSUSE, Arch, Amazon Linux, ...) | [the installer](#any-other-distribution-the-installer) |

**Availability.** Every GitHub Release carries the `.deb`, `.rpm` and tarballs plus `install.sh` and
`SHA256SUMS`. The apt and dnf *repositories* (the `apt install vpsgui` / `dnf install vpsgui`
one-liners) are published to GitHub Pages by the release workflow once the maintainer has configured
the signing key; see [For the maintainer](#for-the-maintainer-one-time-setup). Until then, use the
release assets directly.

## What was tested

Stated plainly, because "all Linux" is a claim that has to be earned per distribution.

| Distribution | glibc | What was run | Result |
|---|---|---|---|
| Ubuntu 26.04 | 2.43 | `.deb` smoke test; `install.sh` smoke test | passed; passed (34 checks) |
| Ubuntu 22.04 | 2.35 | `.deb`; `apt install` from a signed repository | passed |
| Rocky Linux 9.8 | 2.34 | `.rpm` smoke test; `dnf install` from a signed repository; `install.sh` smoke test | passed; passed; passed (34 checks) |
| Rocky Linux 8.10 | 2.28 | `.rpm` smoke test; `dnf install` from a signed repository; `install.sh` smoke test | passed; passed; passed (34 checks) |

The signed-repository runs used a throwaway key and a local `file://` repository, so they prove the
signing and verification flow (a corrupted package and a broken metadata signature were both
refused), not the GitHub Pages deployment, which has not run.

The smoke tests install the package for real on a systemd host and check the service, the token file
mode, that the filesystem root's mode is untouched, nginx, that the console and a static asset really
load, authentication, security headers, a 12 MB upload, token persistence across a reinstall, and
removal. Rocky 8.10 sits exactly on the glibc floor, so it is the strictest case.

**Built but never run:** the `arm64`/`aarch64` and `armhf` packages. They are built, their
dependencies and hashes are checked, but no ARM machine was available to install them on.

**Not tested:** SELinux in enforcing mode (the setup step enables the one boolean nginx needs; see
below), Fedora, openSUSE, Arch, Debian 10-12, Ubuntu 20.04 and 24.04. Their support is inferred from
the dependency check, not observed.

## Requirements

- **systemd.** Without it the files install but the agent is not started.
- **glibc 2.28 or newer.** That is Debian 10, Ubuntu 20.04, RHEL/CentOS/Rocky/Alma 8 and anything
  newer. The packages declare this, so the package manager refuses a host that is too old instead of
  installing something that cannot start.
- **A supported CPU:** `x86_64`, `aarch64`, or 32-bit ARM (`armhf`/`armv7l`, packaged as `.deb` and
  tarball only). 32-bit ARM also needs libstdc++ from GCC 9 (Debian 11+, Ubuntu 20.04+).
- **nginx and openssl.** The package managers install them; the installer does too unless you pass
  `--no-deps`.

**Not supported:** Alpine and other musl distributions (the bundled Node.js needs glibc), RHEL/CentOS
7 and Debian 9 / Ubuntu 18.04 (glibc 2.17 / 2.27, past end of life), and hosts without systemd. Use
the manual install in the README there.

## Debian and Ubuntu (apt)

```bash
curl -fsSL https://notgamerpratham.github.io/vpsgui/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/vpsgui.gpg
echo "deb [signed-by=/usr/share/keyrings/vpsgui.gpg] https://notgamerpratham.github.io/vpsgui/apt stable main" | sudo tee /etc/apt/sources.list.d/vpsgui.list
sudo apt update
sudo apt install vpsgui -y
```

`signed-by` pins the key to this one repository, so it cannot vouch for packages from any other
source, and apt refuses a repository whose `Release` file is altered or unsigned. `apt upgrade` then
keeps VPSGUI current.

## RHEL, Rocky, Alma, Fedora (dnf)

```bash
sudo curl -fsSL https://notgamerpratham.github.io/vpsgui/vpsgui.repo -o /etc/yum.repos.d/vpsgui.repo
sudo dnf install vpsgui -y
```

The repo file turns on `gpgcheck` (every package is signed) **and** `repo_gpgcheck` (the repository
metadata is signed), and names the public key, which dnf asks you to confirm on first use. Compare
the fingerprint it shows with the one the maintainer publishes before accepting.
`yum` works the same way on RHEL 8.

## Any other distribution (the installer)

For openSUSE, Arch, Amazon Linux and anything else with systemd and glibc 2.28+. Download it, read
it, then run it as root: piping a remote script straight into `sudo` runs whatever the URL returns at
that moment.

```bash
curl -fsSLO https://github.com/NotGamerPratham/vpsgui/releases/latest/download/install.sh
```

```bash
less install.sh && sudo sh install.sh
```

It checks systemd, glibc and the CPU, installs nginx/openssl/curl with whichever of `apt`, `dnf`,
`yum`, `zypper` or `pacman` is present, downloads the matching tarball, **verifies its SHA-256**
against the release's `SHA256SUMS`, unpacks it and runs the same configuration step the `.rpm` uses.

That checksum comes from the same release as the archive, so it proves the download is intact, not
that the release is authentic. For authenticity use the signed apt or dnf repository.

Options: `--version X.Y.Z`, `--tarball FILE` (offline), `--no-deps`, `--uninstall`, `--purge`.
`VPSGUI_BASE_URL` points it at a mirror (pair it with `--version`).

On Arch, nginx's stock `nginx.conf` has no `conf.d` include; the installer says so and prints the one
line to add rather than editing your main nginx config.

## From a downloaded package

Take the file for `dpkg --print-architecture` / `uname -m` from the
[latest release](https://github.com/NotGamerPratham/vpsgui/releases/latest):

```bash
sudo apt install ./vpsgui_<version>_<arch>.deb
```

```bash
sudo dnf install ./vpsgui-<version>-1.<arch>.rpm
```

## What gets installed

The same layout on every distribution:

| Path | Contents |
|---|---|
| `/opt/vpsgui/node/` | the bundled Node.js, used only by the agent |
| `/opt/vpsgui/agent/` | the agent, and its state: `agent.env` (the token), `users.db`, the encrypted secret store |
| `/var/www/vpsgui/dist/` | the built console |
| nginx vhost | `sites-available/vpsgui` on Debian-style nginx, `conf.d/vpsgui.conf` elsewhere |
| `vpsgui-agent.service` | the agent's unit, enabled and started on install |

On first install a token is generated into `/opt/vpsgui/agent/agent.env` (mode `0600`):

```bash
sudo cat /opt/vpsgui/agent/agent.env
```

Open `http://<your-server>/` and paste it under **Settings → Agent Token**. The token is
root-equivalent. Put the site behind TLS before signing in from anywhere but localhost:
`sudo certbot --nginx -d <your-domain>`.

The RHEL family, SUSE and Arch install nginx stopped and disabled, so the setup step enables and
starts it. If the stock `nginx.conf` already claims `default_server` for port 80 (RHEL 8 does), the
setup step removes just that word from the stock welcome site, keeping a backup at
`/etc/nginx/nginx.conf.vpsgui-bak`, so that `http://<ip>/` reaches the console. A `default_server`
in anyone else's site is left alone.

**Firewall and SELinux.** If `firewalld` is running with port 80 closed, the setup step prints the
command to open it and does not change the firewall itself. With SELinux enforcing it turns on
`httpd_can_network_connect`, without which nginx cannot reach the agent and every API call returns
502. That path is untested (no SELinux-enforcing host was available); if the console loads but the
API fails, check `ausearch -m avc -ts recent`.

## Upgrades, removal and purge

- **Upgrade** keeps your token, accounts and secrets and restarts the agent. A vhost you edited (for
  TLS or `server_name`) is never overwritten; you get a notice with a `diff` command instead.
- **Remove** stops the agent and stops serving the site but keeps config and data, so a reinstall
  picks up where it left off.
  - `apt remove vpsgui`, `dnf remove vpsgui` or `install.sh --uninstall`.
  - On the RHEL family `dnf` also removes dependencies nothing else needs, which can include nginx.
- **Purge** additionally deletes the token, dashboard accounts and secret store.
  - `apt purge vpsgui` or `install.sh --uninstall --purge`. RPM has no purge, so after
    `dnf remove` run `sudo rm -rf /opt/vpsgui`.
  - `/var/backups/vpsgui` is **never** touched: purging a tool must not destroy the backups it was
    used to take.

`install.sh` refuses to overwrite a `.deb` or `.rpm` install, so two owners never fight over
`/opt/vpsgui`. Going the other way is not guarded: remove an installer-managed install
(`install.sh --uninstall`) before installing a package.

## Already installed with `run.sh`?

`apt install vpsgui`, `dnf install vpsgui` and the installer all take over cleanly: they stop the pm2
process (two supervisors on port 46509 leave one crash-looping), reuse your existing `agent.env`,
and keep the token. Going the other way, remove the package before running `run.sh`.

---

## For the maintainer: one-time setup

Everything is built, tested where a runner allows, and attached to each release by
`.github/workflows/packages.yml`. Publishing the **repositories** needs three things only the
repository owner can do:

1. **Create a signing key**, a dedicated one, never your personal key:

   ```bash
   gpg --quick-generate-key "VPSGUI package repository <you@example.com>" rsa4096 sign 3y
   gpg --armor --export-secret-keys <KEY_ID>      # copy the whole block
   gpg --fingerprint <KEY_ID>                      # publish this in the README
   ```

2. **Add the secrets** under *Settings → Secrets and variables → Actions*:
   `APT_GPG_PRIVATE_KEY` (the block above) and, if the key has a passphrase, `APT_GPG_PASSPHRASE`.
   The one key signs both the apt and the dnf repositories.

3. **Enable Pages** after the first release has created the `gh-pages` branch:
   *Settings → Pages → Source: Deploy from a branch → `gh-pages` / `/ (root)`*.

Until step 2 is done the workflow still builds, tests and attaches everything to the release; it just
skips the repository step with a notice. Cut a release and the repositories appear at
`https://notgamerpratham.github.io/vpsgui/apt` and `.../rpm`, with the public key at `.../key.gpg`.

If you rotate the key, publish the new `key.gpg` and tell users to re-import it: re-run the
`curl ... gpg --dearmor` line on apt, and `sudo rpm -e gpg-pubkey-<id>` then reinstall on dnf.

### Testing a build locally

```bash
npm run build
bash scripts/build-deb.sh     1.6.0 amd64     # -> out/vpsgui_1.6.0_amd64.deb   (also arm64, armhf)
bash scripts/build-rpm.sh     1.6.0 x86_64    # -> out/vpsgui-1.6.0-1.x86_64.rpm (also aarch64)
bash scripts/build-tarball.sh 1.6.0 amd64     # -> out/vpsgui-1.6.0-linux-x64.tar.gz
```

Any host can build any architecture; the only architecture-specific part is the Node.js binary,
downloaded and checked against a pinned SHA-256 (`scripts/lib/node-bundle.sh`). The RPM needs
`rpmbuild` (`apt install rpm`).

Each package has a destructive smoke test that installs it for real on a systemd host and removes it:

```bash
sudo bash scripts/smoke-deb.sh       out/vpsgui_1.6.0_amd64.deb
sudo bash scripts/smoke-rpm.sh       out/vpsgui-1.6.0-1.x86_64.rpm
sudo bash scripts/smoke-installer.sh out/vpsgui-1.6.0-linux-x64.tar.gz
```

CI runs the first and the last. Run `smoke-rpm.sh` by hand on a Rocky/Alma VM before a release: a
GitHub runner has no dnf, and containers have no systemd.
