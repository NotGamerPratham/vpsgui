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
