# CLAUDE.md - Repository Guide for Anthropic Claude

## Commands

- **Development Server**: `npm run dev` (Vite on port 3001; proxies `/api/v1` to the agent on 127.0.0.1:46509)
- **Production Build**: `npm run build` (runs `tsc && vite build`)
- **Type Checking**: `npm run typecheck` (checks both `src` and `tests`)
- **Linting**: `npm run lint` (ESLint)
- **Tests**: `npm test` (Vitest; `npm run test:watch` to watch)
- **Agent**: `npm run agent:start` (the daemon the UI talks to - nothing works without it)
- **Preview Build**: `npm run preview`
- **1-Click Linux Deploy**: `sudo ./run.sh`
- **Bun**: supported alongside Node for everything except the installer. `bun install`, `bun run test`, `bun --bun run build`. Plain `bun run build` silently uses Node, because Bun honours Vite's `#!/usr/bin/env node` shebang unless `--bun` is passed. Scripts that name `node` (`agent:start`) have a `:bun` twin.

## Code Style & Guidelines

- **Icons**: 100% Lucide React icons (`lucide-react`). Never use Unicode emojis.
- **Styling**: Tailwind CSS with custom glassmorphism utilities (`bg-card/70 border-border/70`).
- **State Management**: Zustand for global UI state and server node inventory.
- **API Access**: Use `apiClient` (`src/api/client.ts`) for all REST requests. It attaches the agent token, enforces a timeout, and throws `ApiError` carrying the HTTP status - never call `fetch` directly against the agent.
- **Live Telemetry**: Delivered by polling via `startTelemetryPolling` (`src/services/telemetryPoller.ts`), which republishes on `globalEventBus`. The agent serves **no** WebSocket endpoint; `telemetrySocket` (`src/websocket/socket.ts`) stays dormant unless `VITE_WS_URL` is set for a custom backend.
- **Data Honesty**: Never fall back to invented data when the agent is unreachable. Surface the error and render an empty state - a fabricated "installed"/"active"/"online" reading about a real host is worse than showing nothing.
- **Agent Token**: The single real credential (`localStorage` key `vpsgui_auth_token`, set under Settings). It grants root-equivalent host control; the login page is a local profile gate, not authentication.
- **SDKs**: Node.js SDK in `sdk/node`, Python SDK in `sdk/python`.
- **Author**: NotGamerPratham ([notgamerpratham.com](https://notgamerpratham.com)).
