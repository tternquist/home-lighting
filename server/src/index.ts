import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as wec from './wec';
import * as storage from './storage';
import * as scheduler from './scheduler';
import * as homekit from './homekit';
import { logger, child } from './logger';
import { AppPreset, Schedule, Location } from './types';

const log = child('http');

// __dirname = .../server/src — client dist is two levels up at .../client/dist
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

const app = express();
app.set('trust proxy', 1); // trust X-Forwarded-* headers from nginx
app.use(cors());
app.use(express.json());

// Log every non-poll, non-debug request with response status + latency
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/debug') || req.path === '/api/health') return next();
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const body = req.body && Object.keys(req.body).length ? req.body : undefined;
    const fields = { method: req.method, path: req.path, status: res.statusCode, ms, body };
    if (res.statusCode >= 500) log.error(fields, 'request failed');
    else if (res.statusCode >= 400) log.warn(fields, 'request client error');
    else log.info(fields, 'request');
  });
  next();
});

app.use(express.static(CLIENT_DIST));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let cachedState: wec.ControlState | null = null;
let controllerReachable = false;

function broadcast(data: object) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

async function poll() {
  try {
    const state = await wec.getState();
    cachedState = state;
    controllerReachable = true;
    broadcast({ type: 'state', data: state });
    homekit.notifyStateChange(state);
  } catch {
    controllerReachable = false;
  }
}

setInterval(poll, 60000);
poll();
wec.fetchPresets().catch(err => child('presets').error({ err }, 'failed to load presets'));
homekit.init(wec.sendControl, () => cachedState);
wec.syncClock(storage.getLocation()?.timezone).catch(err => child('clock').error({ err }, 'clock sync failed'));

// Scheduler: apply preset or brightness on trigger
scheduler.init(async (schedule) => {
  if (schedule.action === 'off') {
    await wec.sendControl({ mint: 0 });
  } else if (schedule.action === 'brightness' && schedule.brightness !== undefined) {
    await wec.sendControl({ mint: schedule.brightness });
  } else if (schedule.action === 'preset' && schedule.presetId) {
    await applyPresetById(schedule.presetId);
  }
  await poll();
});

wss.on('connection', ws => {
  if (cachedState) ws.send(JSON.stringify({ type: 'state', data: cachedState }));
  // New client connected — refresh state so the UI isn't showing stale data.
  poll();
});

const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function applyPresetById(id: string) {
  // WEC3 built-in presets have ids like 'wec3-0'
  if (id.startsWith('wec3-')) {
    await wec.applyPreset(parseInt(id.replace('wec3-', '')));
    return;
  }
  // App preset — decompose into individual commands so the controller applies all settings including colors
  const preset = storage.getPresets().find(p => p.id === id);
  if (!preset) throw new Error(`Preset not found: ${id}`);
  const data = JSON.parse(preset.rawPayload) as {
    mint?: number;
    e?: Array<{
      fxnc: number; fx?: string; int?: number;
      spd?: number; speed?: number; trails?: number; spacing?: number; amount?: number;
      dir?: number; rotate?: number;
      color?: Array<{ i?: number; c: string }>;
    }>;
  };
  if (data.mint !== undefined) await wec.sendControl({ mint: data.mint });
  for (const ch of data.e ?? []) {
    const fxn = ch.fxnc;
    if (ch.fx) await wec.sendControl({ fxn, fx: ch.fx });
    if (ch.int !== undefined) await wec.sendControl({ fxn, int: ch.int });
    const spd = ch.spd ?? ch.speed;
    if (spd !== undefined) await wec.sendControl({ fxn, spd: String(spd) });
    if (ch.trails !== undefined) await wec.sendControl({ fxn, trails: String(ch.trails) });
    if (ch.spacing !== undefined) await wec.sendControl({ fxn, spacing: String(ch.spacing) });
    if (ch.amount !== undefined) await wec.sendControl({ fxn, amount: String(ch.amount) });
    if (ch.dir !== undefined) await wec.sendControl({ fxn, dir: String(ch.dir) });
    if (ch.rotate !== undefined) await wec.sendControl({ fxn, rotate: String(ch.rotate) });
    for (const slot of ch.color ?? []) {
      await wec.sendControl({ fxn, color: { i: slot.i, c: slot.c } });
    }
  }
}

/** Capture current state as a raw preset payload */
function currentStateToPayload(state: wec.ControlState): string {
  const e = state.e.map(ch => {
    const obj: Record<string, unknown> = { fxnc: ch.fxn, fx: ch.fx };
    if (ch.int !== 100) obj.int = ch.int;
    if (ch.spd) obj.spd = ch.spd;
    if (ch.trails) obj.trails = ch.trails;
    if (ch.spacing && ch.spacing !== 1) obj.spacing = ch.spacing;
    if (ch.amount && ch.amount !== 10) obj.amount = ch.amount;
    if (ch.dir) obj.dir = ch.dir;
    if (ch.rot) obj.rotate = ch.rot;
    const colors = ch.colors
      .map((c, i) => ({ i: i + 1, c: c.c }))
      .filter(c => c.c !== 'none');
    if (colors.length) obj.color = colors;
    return obj;
  });
  const payload: Record<string, unknown> = { e };
  if (state.mint !== 100) payload.mint = state.mint;
  return JSON.stringify(payload);
}

// ── Status / state ────────────────────────────────────────────────────────────

app.get('/api/status', wrap(async (_req, res) => {
  res.json(await wec.getStatus());
}));

app.get('/api/state', (_req, res) => {
  if (!cachedState) return res.status(503).json({ error: 'No state available yet' });
  res.json(cachedState);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, controllerReachable, stateAge: cachedState ? 'fresh' : 'none' });
});

app.get('/api/debug/log', (_req, res) => res.json(wec.getLog()));

// ── Master / channel control ──────────────────────────────────────────────────

app.post('/api/master/brightness', wrap(async (req, res) => {
  const { brightness } = req.body as { brightness: number };
  await wec.sendControl({ mint: brightness });
  await poll();
  res.json({ ok: true });
}));

app.post('/api/channel/:ch/effect', wrap(async (req, res) => {
  const fxn = parseInt(req.params.ch);
  const { effect } = req.body as { effect: string };
  await wec.sendControl({ fxn, fx: effect });
  await poll();
  res.json({ ok: true });
}));

app.post('/api/channel/:ch/brightness', wrap(async (req, res) => {
  const fxn = parseInt(req.params.ch);
  const { brightness } = req.body as { brightness: number };
  await wec.sendControl({ fxn, int: brightness });
  await poll();
  res.json({ ok: true });
}));

app.post('/api/channel/:ch/color/:slot', wrap(async (req, res) => {
  const fxn = parseInt(req.params.ch);
  const i = parseInt(req.params.slot);
  const { color } = req.body as { color: string };
  await wec.sendControl({ fxn, color: { i, c: color } });
  await poll();
  res.json({ ok: true });
}));

app.post('/api/channel/:ch/param', wrap(async (req, res) => {
  const fxn = parseInt(req.params.ch);
  const { name, value } = req.body as { name: string; value: string | number };
  await wec.sendControl({ fxn, [name]: String(value) });
  await poll();
  res.json({ ok: true });
}));

// ── Presets ───────────────────────────────────────────────────────────────────

app.get('/api/presets', (_req, res) => {
  const wec3 = wec.getCachedPresets().map(p => ({
    id: `wec3-${p.index}`,
    name: p.name,
    source: 'wec3' as const,
    builtIn: true,
  }));
  const app_ = storage.getPresets().map(p => ({
    id: p.id,
    name: p.name,
    source: 'app' as const,
    builtIn: p.builtIn ?? false,
  }));
  res.json([...wec3, ...app_]);
});

app.post('/api/presets/:id/apply', wrap(async (req, res) => {
  await applyPresetById(req.params.id);
  await poll();
  res.json({ ok: true });
}));

// Save current state as new preset
app.post('/api/presets', wrap(async (req, res) => {
  const { name } = req.body as { name: string };
  if (!cachedState) { res.status(503).json({ error: 'No state cached' }); return; }
  const preset: AppPreset = {
    id: uuidv4(),
    name,
    rawPayload: currentStateToPayload(cachedState),
  };
  storage.savePreset(preset);
  res.json({ id: preset.id, name: preset.name, source: 'app', builtIn: false });
}));

app.delete('/api/presets/:id', (req, res) => {
  storage.deletePreset(req.params.id);
  res.json({ ok: true });
});

// ── Shows ─────────────────────────────────────────────────────────────────────

app.post('/api/shows/:id/play', wrap(async (req, res) => {
  await wec.sendControl({ fx: `Show ${req.params.id}` });
  await poll();
  res.json({ ok: true });
}));

// ── Schedules ─────────────────────────────────────────────────────────────────

app.get('/api/schedules', (_req, res) => {
  res.json(storage.getSchedules());
});

app.get('/api/schedules/upcoming', (_req, res) => {
  const upcoming = scheduler.getUpcoming(10).map(({ schedule, time }) => ({
    scheduleId: schedule.id,
    name: schedule.name,
    time: time.toISOString(),
  }));
  res.json(upcoming);
});

app.post('/api/schedules', (req, res) => {
  const body = req.body as Omit<Schedule, 'id'>;
  const schedule: Schedule = { ...body, id: uuidv4() };
  storage.saveSchedule(schedule);
  res.json(schedule);
});

app.put('/api/schedules/:id', (req, res) => {
  const schedule = req.body as Schedule;
  schedule.id = req.params.id;
  storage.saveSchedule(schedule);
  res.json(schedule);
});

app.delete('/api/schedules/:id', (req, res) => {
  storage.deleteSchedule(req.params.id);
  res.json({ ok: true });
});

// ── Location ──────────────────────────────────────────────────────────────────

app.get('/api/location', (_req, res) => {
  res.json(storage.getLocation());
});

app.put('/api/location', (req, res) => {
  const loc = req.body as Location;
  storage.saveLocation(loc);
  res.json(loc);
});

// ── Device info, light sensor, clock sync ────────────────────────────────────

app.get('/api/device/config', wrap(async (_req, res) => {
  res.json(await wec.getConfig());
}));

app.get('/api/device/sensor', wrap(async (_req, res) => {
  res.json(await wec.getLightSensor());
}));

app.post('/api/device/sensor', wrap(async (req, res) => {
  await wec.sendControl(req.body as object);
  res.json({ ok: true });
}));

app.post('/api/device/sync-clock', wrap(async (_req, res) => {
  const loc = storage.getLocation();
  await wec.syncClock(loc?.timezone ?? undefined);
  res.json({ ok: true, syncedAt: new Date().toISOString() });
}));

// ── Settings export / import ──────────────────────────────────────────────────

app.get('/api/settings/export', (_req, res) => {
  res.json({
    version: '1',
    exportedAt: new Date().toISOString(),
    presets: storage.getPresets().filter(p => !p.builtIn),
    schedules: storage.getSchedules(),
    location: storage.getLocation(),
  });
});

app.post('/api/settings/import', (req, res) => {
  const { presets = [], schedules = [], location } = req.body as {
    version?: string;
    presets?: AppPreset[];
    schedules?: Schedule[];
    location?: Location | null;
  };

  for (const preset of presets) {
    if (!preset.builtIn && preset.id && preset.name && preset.rawPayload) {
      storage.savePreset(preset);
    }
  }

  // Replace all schedules, assigning fresh UUIDs to avoid cross-instance conflicts
  for (const s of storage.getSchedules()) storage.deleteSchedule(s.id);
  for (const schedule of schedules) {
    storage.saveSchedule({ ...schedule, id: uuidv4() });
  }

  if (location && typeof location.lat === 'number') {
    storage.saveLocation(location);
  }

  res.json({ ok: true });
});

// ── SPA catch-all ─────────────────────────────────────────────────────────────

app.get('*', (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  log.error({ err, method: req.method, path: req.path }, 'unhandled request error');
  res.status(500).json({ error: err.message });
});

const PORT = parseInt(process.env.PORT || '4001');
server.listen(PORT, () => {
  logger.info(
    { port: PORT, wecUrl: process.env.WEC_URL || 'http://192.168.7.6' },
    'home-lighting server started',
  );
});
