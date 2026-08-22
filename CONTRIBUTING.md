# Contributing to VPSGUI

We welcome contributions to **VPSGUI**!

## How to Contribute

1. **Fork the Repository** on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**:
   ```bash
   git commit -m "feat: add amazing feature"
   ```
4. **Push to the branch**:
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**.

## Local development

```bash
npm install
```

The UI is useless without the agent, so run it in a second terminal. The Vite dev server proxies
`/api/v1` to `127.0.0.1:46509`:

```bash
npm run agent:start
```

```bash
npm run dev
```

The agent prints a token on first start. Paste it into **Settings → Agent Token**.

## Before opening a PR

Run all four. CI runs the same set, so a PR that skips them will fail:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

| Command | Checks |
| :--- | :--- |
| `npm run typecheck` | TypeScript across both `src` and `tests` |
| `npm run lint` | ESLint |
| `npm test` | Vitest - includes agent integration tests that boot the real daemon |
| `npm run build` | Production bundle compiles |

## Code Standards

- **TypeScript**: Strict mode enabled. No `any` types unless explicitly justified.
- **Icons**: Strictly use Lucide React icons (`lucide-react`). No emojis.
- **API access**: Always go through `apiClient` (`src/api/client.ts`). Never call `fetch` directly
  against the agent - the client attaches the token, enforces a timeout, and throws a typed
  `ApiError`.
- **Never invent data.** If the agent is unreachable or an endpoint is unimplemented, surface the
  error and render an empty state. A fabricated "installed" or "active" reading about someone's real
  server is worse than showing nothing, and several such fallbacks have already had to be removed.

## Touching the agent

`agent/server.js` runs as root and is the project's security boundary. Changes there need extra care:

- Every endpoint except `/health` must require the bearer token.
- Filesystem access must go through `resolveSafePath()`, which confines paths to
  `AGENT_FILE_ROOTS` and resolves symlinks.
- Spawn child processes with `execFile` and an argument array - never string concatenation into a
  shell. The one exception is `/terminal/exec`, which is shell-by-design and token-gated.
- Add a test in `tests/agentServer.test.ts`. It boots the real daemon and asserts on authentication,
  path confinement, and input validation.

## Releasing

Publishing runs from `.github/workflows/publish.yml` and is triggered by publishing a GitHub
Release, or manually via **Actions → Publish → Run workflow**. Nothing reaches a registry until the
`verify` job has built both SDKs, confirmed the `vpsgui` binary exists and is executable, checked
the tarball actually contains it, and re-run the shared CLI config tests from both sides.

Registry versions cannot be replaced, so bump the version first and let the release be the trigger.

### The Node package goes to two registries under two names

| Registry | Published name | Install |
| --- | --- | --- |
| npmjs.com | `vpsgui` | `npm i -g vpsgui` |
| GitHub Packages | `@notgamerpratham/vpsgui` | `npm i -g @notgamerpratham/vpsgui` (requires auth) |

The names differ because **GitHub Packages only accepts scoped npm packages, and the scope must be
the repository owner**. `sdk/node/package.json` carries `publishConfig.registry` pointing at GitHub
Packages, so a bare `npm publish` targets it; the workflow rewrites the name to the scoped form
first. The npmjs leg overrides the registry instead and keeps the unscoped name, because that is
what `npm i -g vpsgui` resolves.

Both halves must be lowercase - GitHub Packages rejects capitals in a name or scope - which is why
the workflow lowercases `github.repository_owner` before setting the name. `actions/setup-node`
independently lowercases the same value when it writes the `.npmrc`, so the two agree.

`setup-node` writes a *scoped* registry line (`@owner:registry=...`), not a global default. That
matters: a global default would send `npm install` to GitHub Packages looking for `typescript` and
`@types/node`, which do not exist there, and the publish job would fail before it published
anything.

### Visibility on GitHub Packages is not npm's `access` field

A package published to GitHub Packages **inherits the visibility of the repository it is linked
to**. `vpsgui` is currently a private repository, so the GitHub Packages copy is private too, and
installing it needs a personal access token with `read:packages`:

```ini
# ~/.npmrc
@notgamerpratham:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_PERSONAL_ACCESS_TOKEN
```

`publishConfig` deliberately does **not** set `"access": "public"`. That is an npmjs concept; on
GitHub Packages it changes nothing, and stating it implies a visibility the package will not have.
To make the package public, either make the repository public or change the package's visibility in
its GitHub Packages settings.

npmjs.com is therefore the registry to point users at - `npm i -g vpsgui` needs no token and no
`.npmrc`. GitHub Packages is a mirror for people who already have repo access.

The `bin` entry stays `vpsgui` in both, so the command is the same whichever one you install.

### Secrets

| Secret | Used by | Notes |
| --- | --- | --- |
| `NPM_TOKEN` | the npmjs job | An npmjs automation token with publish rights. |
| `GITHUB_TOKEN` | the GitHub Packages job | Provided automatically; the job requests `packages: write`. |

### The Python package

PyPI publishing is still manual. `sdk/python/pyproject.toml` declares the `vpsgui = "vpsgui.cli:main"`
console script, so the wheel carries the same CLI.

```bash
cd sdk/python
python -m build
twine upload dist/*
```

### Keep the two CLIs in step

`sdk/node/src/config.ts` and `sdk/python/vpsgui/config.py` implement the same on-disk format, because
both packages install a binary called `vpsgui` and only one can win on `PATH`. Change one and you
must change the other; `tests/cliConfig.test.ts` and `sdk/python/tests/test_config.py` assert the
contract from both sides and both run in `verify` before anything publishes.

Bump all three versions together: `sdk/node/package.json`, `sdk/python/pyproject.toml`, and
`sdk/python/vpsgui/__init__.py`, plus `VERSION` in each CLI.
