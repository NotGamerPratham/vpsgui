# Agent Instructions & Project Guidelines for VPSGUI

This document defines mandatory directives and project guidelines for AI coding agents contributing to **VPSGUI**.

## Core Rules

1. **NO EMOJIS**: Do not use emojis in UI code, text labels, documentation, or commit messages. Use clean, modern icons from `lucide-react` exclusively.
2. **OPEN SOURCE PROJECT**: VPSGUI is an open-source project created by **NotGamerPratham** ([notgamerpratham.com](https://notgamerpratham.com)). Maintain clean, professional, reusable, and self-documenting code.
3. **STRICT ZERO-MOCK / FAKE DATA POLICY**:
   - Never render fake simulated data (e.g. `Math.random()` loops, sine wave metrics) when unattached.
   - Fetch real metrics via `apiClient` (`/api/v1`) or WebSocket streams (`telemetrySocket`).
   - If an endpoint returns an empty dataset or is unattached, display clean, production-grade empty states guiding the user to connect their Linux VPS via `install.sh`.
4. **LINUX VPS DISCOVERY**:
   - Host VPS resolution must dynamically target `window.location.hostname` or `window.location.origin`.
   - Real hardware stats must inspect browser primitives (`navigator.hardwareConcurrency`) and actual server endpoints.
5. **AESTHETICS & UI QUALITY**:
   - Glassmorphic panels (`bg-card/70 border-border/70`).
   - Monospace accents for IPs, hashes, paths, ports, and metrics.
   - Smooth badge states and dark-first color system.

## Project Architecture

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Zustand, TanStack Query.
- **REST Client**: `src/api/client.ts` targeting `/api/v1`.
- **WebSocket Manager**: `src/websocket/socket.ts` listening on `/ws`.
- **SDKs**: `vpsgui-sdk` (Node/npm) and `vpsgui` (Python/PyPI) in `sdk/`.

## Verification Requirement

Before completing any task, run `npm run build` to ensure 0 TypeScript compilation errors.
