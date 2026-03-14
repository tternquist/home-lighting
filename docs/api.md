# API Reference

All endpoints are served by the Express server (default port `4001`). Responses are JSON. Mutations trigger a poll of the WEC3 controller and return `{ ok: true }` on success.

---

## Health & diagnostics

### `GET /api/health`
Lightweight liveness check.

```json
{ "ok": true, "controllerReachable": true, "stateAge": "fresh" }
```

`stateAge` is `"fresh"` once the first poll succeeds, `"none"` before that.

### `GET /api/status`
Full device status from the WEC3 controller.

```json
{
  "status": {
    "man": "Minleon",
    "mod": "WEC3",
    "mac": "e3:64:00:00:00:00",
    "ver": "1.0",
    "sver": "2.3",
    "name": "wec-e364",
    "uuid": "..."
  }
}
```

### `GET /api/state`
Returns the most recently cached control state. Returns `503` if no poll has succeeded yet.

```json
{
  "mint": 100,
  "e": [
    {
      "fxn": 1,
      "fx": "Fixed Colors",
      "int": 80,
      "spd": 50,
      "trails": 0,
      "amount": 10,
      "spacing": 1,
      "dir": 0,
      "rot": 0,
      "colors": [
        { "c": "#ff8000" },
        { "c": "cw" },
        { "c": "none" }
      ]
    },
    { "fxn": 2, "fx": "Glow", "int": 60, ... }
  ]
}
```

### `GET /api/debug/log`
Returns the last 100 WEC3 HTTP calls made by the server, newest first.

```json
[
  {
    "ts": "2026-03-14T12:00:00.000Z",
    "method": "POST",
    "path": "/api/control",
    "payload": { "fxn": 1, "int": 80 },
    "status": 200,
    "ms": 34
  }
]
```

---

## Master brightness

### `POST /api/master/brightness`
Sets the master intensity (`mint`) across all channels.

**Request**
```json
{ "brightness": 75 }
```
`brightness` — integer 0–100.

---

## Channel control

All channel endpoints use `:ch` = the channel's `fxn` number (`1` or `2`).

### `POST /api/channel/:ch/effect`
Sets the active effect for a channel.

**Request**
```json
{ "effect": "Chase" }
```

**Available effects**

| Name | Name | Name |
|------|------|------|
| Bands | Bars | Blend |
| Chase | Circles | Color Change |
| Color Wave | Expand | Fader |
| Fixed Colors | Glow | Lightning |
| Markers | Paint | Ping Pong |
| Pulsate | Shift | Snow |
| Sparkle | Twist | Worms |

### `POST /api/channel/:ch/brightness`
Sets the channel intensity.

**Request**
```json
{ "brightness": 50 }
```
`brightness` — integer 0–100. Setting to `0` effectively turns the channel off.

### `POST /api/channel/:ch/color/:slot`
Sets a color in a specific color slot (`:slot` is 1-indexed).

**Request**
```json
{ "color": "#ff0000" }
```

`color` accepts:
- `"#rrggbb"` — hex color
- `"ww"` — warm white
- `"cw"` — cool white
- `"none"` — empty / off

### `POST /api/channel/:ch/param`
Sets an arbitrary effect parameter.

**Request**
```json
{ "name": "spd", "value": 75 }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `spd`     | number 0–100 | Animation speed |
| `trails`  | number | Trail length |
| `spacing` | number | Pixel spacing |
| `amount`  | number | Number of elements |
| `dir`     | 0 or 1 | Animation direction |
| `rotate`  | 0 or 1 | Rotation on/off |

---

## Presets

### `GET /api/presets`
Returns all available presets — WEC3 built-ins and app-saved — combined.

```json
[
  { "id": "wec3-0", "name": "Rainbow", "source": "wec3", "builtIn": true },
  { "id": "wec3-1", "name": "Ocean",   "source": "wec3", "builtIn": true },
  { "id": "a1b2c3...", "name": "Evening", "source": "app", "builtIn": false }
]
```

### `POST /api/presets/:id/apply`
Applies a preset. WEC3 presets are sent as raw payloads; app presets are decomposed into individual channel commands so colors and parameters are fully restored.

### `POST /api/presets`
Saves the current controller state as a new app preset.

**Request**
```json
{ "name": "My preset" }
```

**Response**
```json
{ "id": "uuid", "name": "My preset", "source": "app", "builtIn": false }
```

### `DELETE /api/presets/:id`
Deletes an app preset. Built-in presets cannot be deleted.

---

## Shows

### `POST /api/shows/:id/play`
Triggers a WEC3 show by index.

```
POST /api/shows/3/play
```

---

## Schedules

### `GET /api/schedules`
Returns all saved schedules.

```json
[
  {
    "id": "uuid",
    "name": "Evening warm",
    "enabled": true,
    "trigger": "sunset",
    "offsetMinutes": -30,
    "action": "preset",
    "presetId": "uuid",
    "days": [1, 2, 3, 4, 5]
  }
]
```

**Schedule fields**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID |
| `name` | string | Display name |
| `enabled` | boolean | Whether the schedule is active |
| `trigger` | `"time"` \| `"sunrise"` \| `"sunset"` | When to trigger |
| `offsetMinutes` | number | For `"time"`: minutes since midnight. For `"sunrise"`/`"sunset"`: offset in minutes (negative = before) |
| `action` | `"preset"` \| `"brightness"` \| `"off"` | What to do when triggered |
| `presetId` | string? | Required when `action = "preset"` |
| `brightness` | number? | Required when `action = "brightness"` (0–100) |
| `days` | number[] | Days to run: 0=Sun … 6=Sat. Empty array = every day |

### `GET /api/schedules/upcoming`
Returns the next 10 schedule trigger times.

```json
[
  {
    "scheduleId": "uuid",
    "name": "Evening warm",
    "time": "2026-03-14T23:30:00.000Z"
  }
]
```

### `POST /api/schedules`
Creates a new schedule. Accepts all fields except `id` (assigned automatically).

### `PUT /api/schedules/:id`
Replaces an existing schedule.

### `DELETE /api/schedules/:id`
Deletes a schedule.

---

## Location

Used by the scheduler to calculate local sunrise and sunset times.

### `GET /api/location`
Returns the stored location, or `null` if not set.

```json
{
  "lat": 44.98,
  "lon": -93.27,
  "name": "Minneapolis, MN",
  "timezone": "America/Chicago"
}
```

### `PUT /api/location`
Saves the location.

**Request** — same shape as the response above.

---

## WebSocket

Connect to `ws://<host>:<port>/ws`. The server sends a state message immediately on connection and then after every poll (every 2 seconds).

**Message format**
```json
{ "type": "state", "data": { ...ControlState } }
```

The client suppresses incoming state messages for 1.5 seconds after a local mutation to prevent UI flicker.
