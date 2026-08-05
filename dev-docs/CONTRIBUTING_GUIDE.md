# VPSGUI Open Source Contribution Guide

Thank you for contributing to **VPSGUI**, an open-source project created by **NotGamerPratham** ([notgamerpratham.com](https://notgamerpratham.com)).

Repository: [https://github.com/NotGamerPratham/vpsgui](https://github.com/NotGamerPratham/vpsgui)

---

## Code Guidelines

1. **NO EMOJIS**: Do not use emojis in UI code, documentation, or commit messages. Use clean icons from `lucide-react`.
2. **STRICT ZERO-MOCK DATA**: Never render fake simulated data (`Math.random()`, fake metrics). Fetch real metrics from `/api/v1` or render clean empty states.
3. **TYPE SAFETY**: All code must pass `npm run build` (`tsc && vite build`) with zero TypeScript compilation errors.
4. **DESIGN SYSTEM**: Dark-first glassmorphic UI (`bg-card/70 border-border/70`), monospace font accents for IPs, hashes, ports, and paths.

---

## Local Development Workflow

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/NotGamerPratham/vpsgui.git
   cd vpsgui
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Verify Production Build**:
   ```bash
   npm run build
   ```

---

## Reporting Issues & Sponsoring

- **Report Bug / Feature Request**: [GitHub Issues](https://github.com/NotGamerPratham/vpsgui/issues)
- **Sponsor Project**: [GitHub Sponsors / Support](https://notgamerpratham.com)
