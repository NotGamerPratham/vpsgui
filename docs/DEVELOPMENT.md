# VPSGUI Developer Setup & Contribution Guide

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**

## Local Workspace Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/vpsgui/vpsgui.git
   cd vpsgui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## Adding Custom Catalog Templates

Add new catalog items to `src/services/catalogService.ts` or register a new plugin in `src/types/plugin.ts`.
