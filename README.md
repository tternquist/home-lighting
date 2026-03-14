# Home Lighting

A web-based controller for the **Minleon WEC3** LED controller, with real-time updates, scheduling, preset management, and native HomeKit support.

## Features

- **Web UI** — control channels, effects, brightness, and colors from any browser on your LAN
- **HomeKit bridge** — exposes both LED channels as Lightbulb accessories (on/off, brightness, color)
- **Presets** — save and restore full lighting states; also exposes the WEC3's built-in presets
- **Scheduler** — time-based or sunrise/sunset-relative automations per day of week
- **Real-time** — WebSocket pushes state to all connected clients every 2 seconds

## Quick start (Docker)

```bash
git clone https://github.com/tternquist/home-lighting.git
cd home-lighting
# edit WEC_URL in docker-compose.yml to match your controller's IP
docker compose up -d --build
```

Web UI: `http://<host>:4001`

See [DEPLOY.md](DEPLOY.md) for full deployment and HomeKit pairing instructions.

## Development

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev:hot   # server on :4001, Vite dev server on :5173 with HMR
```

Or build and run as production would:

```bash
npm run build
node server/dist/index.js
```

### Environment variables

| Variable   | Default               | Description                              |
|------------|-----------------------|------------------------------------------|
| `PORT`     | `4001`                | HTTP + WebSocket server port             |
| `WEC_URL`  | `http://192.168.7.6`  | Base URL of the WEC3 controller          |
| `HAP_NAME` | `Home Lighting`       | Bridge display name — **must be unique per instance on the LAN** |
| `HAP_PIN`  | `031-45-154`          | HomeKit pairing code                     |
| `HAP_PORT` | `47129`               | HomeKit accessory protocol (HAP) port    |

Client-side (prefix with `VITE_`, set in `.env`):

| Variable       | Default        | Description                              |
|----------------|----------------|------------------------------------------|
| `VITE_WS_URL`  | auto-detected  | WebSocket URL (falls back to `ws[s]://<host>/ws`) |

## Project layout

```
home-lighting/
├── server/
│   └── src/
│       ├── index.ts      # Express app, WebSocket server, API routes
│       ├── wec.ts        # WEC3 HTTP client and type definitions
│       ├── homekit.ts    # hap-nodejs bridge (HomeKit)
│       ├── scheduler.ts  # Cron-based automation engine
│       ├── storage.ts    # JSON file persistence
│       └── types.ts      # Shared server types
├── client/
│   └── src/
│       ├── App.tsx       # Root component, WebSocket connection
│       ├── api.ts        # Typed API client
│       ├── types.ts      # Client-side types
│       └── components/
│           ├── Dashboard.tsx
│           ├── ChannelCard.tsx
│           ├── ColorSlot.tsx
│           ├── PresetGrid.tsx
│           ├── SchedulePanel.tsx
│           ├── DebugLog.tsx
│           └── HomeKitPage.tsx
├── Dockerfile
├── docker-compose.yml
├── DEPLOY.md
└── docs/
    ├── api.md            # REST API reference
    └── architecture.md   # System architecture
```

## Documentation

- [API reference](docs/api.md)
- [Architecture](docs/architecture.md)
- [Deployment & HomeKit setup](DEPLOY.md)
