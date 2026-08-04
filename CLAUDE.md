# CLAUDE.md - Repository Guide for Anthropic Claude

## Commands

- **Development Server**: `npm run dev` (runs Vite dev server on port 3001)
- **Production Build**: `npm run build` (runs `tsc && vite build`)
- **Type Checking**: `npm run lint` (runs `tsc --noEmit`)
- **Preview Build**: `npm run preview`
- **1-Click Linux Deploy**: `chmod +x run.sh && ./run.sh`

## Code Style & Guidelines

- **Icons**: 100% Lucide React icons (`lucide-react`). Never use Unicode emojis.
- **Styling**: Tailwind CSS with custom glassmorphism utilities (`bg-card/70 border-border/70`).
- **State Management**: Zustand for global UI state and server node inventory.
- **API Access**: Use `apiClient` (`src/api/client.ts`) for REST requests and `telemetrySocket` (`src/websocket/socket.ts`) for real-time WebSocket streams.
- **SDKs**: Node.js SDK in `sdk/node`, Python SDK in `sdk/python`.
- **Author**: NotGamerPratham ([notgamerpratham.com](https://notgamerpratham.com)).
