# Ganatri Development Server

Start all three development services with a single command.

## Quick Start

```bash
npm run dev
```

This starts:
- **Server** on `http://localhost:3000` (Socket.io backend)
- **Web App** on `http://localhost:5173` (React + Vite frontend)
- **Storybook** on `http://localhost:6006` (Component library workbench)

## Manual Alternative

If you prefer to start services individually:

```bash
# Terminal 1: Server
cd packages/server && npm run dev

# Terminal 2: Web
cd packages/web && npm run dev

# Terminal 3: Storybook
cd packages/ds && npm run storybook
```

## Stopping Services

Press `Ctrl+C` in the main terminal to stop all services at once (when using `npm run dev`).

## Environment Setup

Make sure you have:
- Node.js ≥ 22
- Dependencies installed: `npm install` (runs automatically if missing)
- `.env` file in `packages/server/` if you need custom config

## Troubleshooting

**Port already in use:**
- Server (3000): `lsof -i :3000 && kill -9 <PID>`
- Web (5173): `lsof -i :5173 && kill -9 <PID>`
- Storybook (6006): `lsof -i :6006 && kill -9 <PID>`

**Dependencies not installing:**
```bash
npm install
npm run build  # Ensure all workspaces are built
```

**Hot reload not working:**
- Server: Ensure `tsx watch` is running (restart `npm run dev`)
- Web: Vite should auto-refresh; clear browser cache if stuck
- Storybook: Clear `.storybook-cache` if stories don't update
