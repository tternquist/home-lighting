# Architecture

## Overview

```
┌─────────────────────────────────────────────┐
│                  Host LAN                    │
│                                             │
│  ┌──────────────┐      ┌─────────────────┐  │
│  │  iOS / macOS  │      │  Any browser    │  │
│  │  Home app     │      │  Web UI         │  │
│  └──────┬───────┘      └────────┬────────┘  │
│         │ mDNS + HAP            │ HTTP/WS   │
│         ▼                       ▼           │
│  ┌──────────────────────────────────────┐   │
│  │           Node.js server             │   │
│  │                                      │   │
│  │  Express (port 4001)                 │   │
│  │  ├─ REST API  /api/*                 │   │
│  │  ├─ WebSocket  /ws                   │   │
│  │  └─ Static files  (client/dist)      │   │
│  │                                      │   │
│  │  HAP bridge (port 47129)             │   │
│  │                                      │   │
│  │  Scheduler (node-cron, 1-min tick)   │   │
│  └──────────────────┬───────────────────┘   │
│                     │ HTTP                   │
│                     ▼                       │
│            ┌────────────────┐               │
│            │  Minleon WEC3  │               │
│            │  LED controller│               │
│            └────────────────┘               │
└─────────────────────────────────────────────┘
```

## Server

### `index.ts` — entry point

Bootstraps everything and wires it together:

1. Creates the Express app and HTTP server
2. Attaches the WebSocket server to the same HTTP port
3. Starts the 2-second poll loop against the WEC3 controller
4. Initialises the scheduler
5. Initialises the HomeKit bridge
6. Registers all REST routes

**Poll loop** — every 2 seconds the server calls `GET /api/control` on the WEC3. On success it caches the result, broadcasts it to all WebSocket clients, and notifies the HomeKit bridge. On failure it marks the controller as unreachable (surfaced via `/api/health`).

**State mutation pattern** — every REST endpoint that changes controller state calls `wec.sendControl(payload)` and then `poll()` to immediately refresh the cache. This keeps the WebSocket broadcast loop consistent with mutations.

### `wec.ts` — WEC3 client

Thin axios wrapper around the WEC3 HTTP API. All calls are logged (last 100 entries kept in memory, exposed via `/api/debug/log`).

Key functions:

| Function | Description |
|----------|-------------|
| `getState()` | `GET /api/control` — returns full `ControlState` |
| `sendControl(payload)` | `POST /api/control` with JSON body |
| `fetchPresets()` | `GET /ppresets.html`, parses embedded preset definitions from HTML |
| `applyPreset(index)` | `POST /api/control` with the raw preset payload string |

> **WEC3 quirk:** preset payloads stored in the controller's HTML page are sometimes not valid JSON. They are transmitted as raw `text/plain` to avoid serialisation errors.

### `homekit.ts` — HAP bridge

Uses `hap-nodejs` to advertise a HomeKit **Bridge** accessory containing two **Lightbulb** services (one per WEC3 channel).

**Discovery:** hap-nodejs uses mDNS (Bonjour) to advertise itself on the local network. This requires the process to be reachable via multicast — see [DEPLOY.md](../DEPLOY.md) for the Docker `network_mode: host` requirement.

**Characteristic mapping:**

| HomeKit | WEC3 |
|---------|------|
| `On = false` | `{ fxn, int: 0 }` |
| `On = true` | `{ fxn, int: lastBrightness }` (default 100) |
| `Brightness` | `{ fxn, int: value }` |
| `Hue` + `Saturation` | Switch to *Fixed Colors* effect, set color slot 1 as `#rrggbb` |

**Color model:** HomeKit uses HSB (hue 0–360, saturation 0–100). The WEC3 stores colors as `#rrggbb` hex, `"ww"` (warm white), or `"cw"` (cool white). Conversion is done with inline HSV↔RGB helpers. `"ww"` is approximated as H:38 S:30; `"cw"` as H:210 S:10.

**Hue/Saturation debounce:** HomeKit fires separate SET events for hue and saturation. A 50 ms debounce per channel accumulates both values before sending a single combined command to the WEC3.

**State sync:** `notifyStateChange()` is called after every poll. It calls `.updateValue()` on each characteristic so the Home app reflects changes made from the web UI or scheduler within ~2 seconds.

**Pairing persistence:** hap-nodejs writes pairing keys to `server/data/hap-persist/`. This directory must survive container restarts (handled by the volume mount in `docker-compose.yml`).

### `scheduler.ts` — automation engine

Runs a node-cron job every minute. For each enabled schedule it:

1. Calculates the trigger time for today using the stored location:
   - `"time"` — converts `offsetMinutes` from midnight to a `HH:MM` wall-clock time
   - `"sunrise"` / `"sunset"` — uses `suncalc` to get today's sun event, then adds `offsetMinutes`
2. Checks whether the current minute matches the trigger time
3. If `days` is non-empty, skips days not in the list (0 = Sunday … 6 = Saturday)
4. Executes the action (`off`, `brightness`, or `preset`) via the same `wec.sendControl` / `applyPresetById` path used by REST endpoints
5. Calls `poll()` to refresh cached state

### `storage.ts` — persistence

All state is stored as JSON files under `server/data/`:

| File | Contents |
|------|----------|
| `presets.json` | `AppPreset[]` — user-saved lighting states |
| `schedules.json` | `Schedule[]` — automation rules |
| `location.json` | `Location` — lat/lon/timezone for sun calculations |

The directory is created automatically on first write. There is no database — reads parse the file each time, writes atomically replace it.

**Built-in presets** are seeded into `presets.json` on first run (if the file is empty or missing). They carry `builtIn: true` and cannot be deleted via the API.

## Client

Single-page React application built with Vite and styled with Tailwind CSS.

### State flow

```
WebSocket message
       │
       ▼
  App.tsx useState
       │
       ├──▶ Dashboard (read state, render)
       │
       └──▶ mutate(updater)
               │
               ├─ optimistic update (setState locally)
               ├─ suppress WebSocket for 1.5 s
               └─ API call (fire-and-forget, server polls and broadcasts)
```

The **optimistic update + suppression** pattern means sliders feel instant — the UI updates immediately on interaction rather than waiting for the server round-trip.

### Routing

There is no routing library. A `page` string in `App.tsx` state controls which top-level view is rendered (`"dashboard"` or `"homekit"`). Navigation is handled by passing `onNavigate` callbacks down to components.

### Component responsibilities

| Component | Responsibility |
|-----------|---------------|
| `App` | WebSocket lifecycle, global state, page routing |
| `Dashboard` | Layout, master brightness slider, nav to HomeKit page |
| `ChannelCard` | Per-channel effect, brightness, colors, advanced params |
| `ColorSlot` | Individual color swatch with hex/ww/cw/none picker |
| `PresetGrid` | List WEC3 + app presets; apply, save, delete |
| `SchedulePanel` | List/create/edit/delete schedules; location config |
| `DebugLog` | Collapsible panel showing recent WEC3 API calls |
| `HomeKitPage` | Static setup guide — PIN display, pairing steps, Siri examples |

### Debouncing

All continuous inputs (sliders) debounce through a shared `useDebounce` hook before firing an API call:

- Brightness / speed / parameter sliders — 120 ms
- HomeKit hue + saturation — 50 ms (in `homekit.ts`)

This prevents flooding the WEC3 while still feeling responsive.

## Data flow diagram

```
User drags brightness slider
        │
        ▼
  ChannelCard onChange
        │
        ├─ mutate(s => ...) ──▶ optimistic UI update
        │
        └─ sendMasterBrightness(v)  [debounced 120ms]
                │
                ▼
        POST /api/channel/1/brightness
                │
                ▼
        wec.sendControl({ fxn:1, int:v })
                │
                ▼
        POST http://192.168.7.6/api/control
                │
                ▼
        poll() ──▶ GET /api/control ──▶ cachedState updated
                         │
                         ├─▶ broadcast() ──▶ WebSocket ──▶ all clients
                         │
                         └─▶ homekit.notifyStateChange() ──▶ .updateValue()
```

## Persistence diagram

```
server/data/
├── presets.json      ←─ GET/POST/DELETE /api/presets
├── schedules.json    ←─ GET/POST/PUT/DELETE /api/schedules
├── location.json     ←─ GET/PUT /api/location
└── hap-persist/
    ├── AccessoryInfo.175107F4BC8A.json   ← HomeKit pairing keys
    └── IdentifierCache.175107F4BC8A.json ← Characteristic ID map
```
