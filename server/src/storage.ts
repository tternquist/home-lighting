import fs from 'fs';
import path from 'path';
import { AppPreset, Schedule, Location } from './types';

// __dirname = .../server/src — data lives one level up at .../server/data
const DATA_DIR = path.resolve(__dirname, '../data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read<T>(file: string, fallback: T): T {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function write(file: string, data: unknown) {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// ── Presets ──────────────────────────────────────────────────────────────────

export function getPresets(): AppPreset[] {
  return read<AppPreset[]>('presets.json', DEFAULT_PRESETS);
}

export function savePreset(preset: AppPreset) {
  const all = getPresets();
  const idx = all.findIndex(p => p.id === preset.id);
  if (idx >= 0) all[idx] = preset; else all.push(preset);
  write('presets.json', all);
}

export function deletePreset(id: string) {
  write('presets.json', getPresets().filter(p => p.id !== id && !p.builtIn));
}

// ── Schedules ─────────────────────────────────────────────────────────────────

export function getSchedules(): Schedule[] {
  return read<Schedule[]>('schedules.json', []);
}

export function saveSchedule(schedule: Schedule) {
  const all = getSchedules();
  const idx = all.findIndex(s => s.id === schedule.id);
  if (idx >= 0) all[idx] = schedule; else all.push(schedule);
  write('schedules.json', all);
}

export function deleteSchedule(id: string) {
  write('schedules.json', getSchedules().filter(s => s.id !== id));
}

// ── Location ──────────────────────────────────────────────────────────────────

export function getLocation(): Location | null {
  return read<Location | null>('location.json', null);
}

export function saveLocation(loc: Location) {
  write('location.json', loc);
}

// ── Built-in presets ──────────────────────────────────────────────────────────

const DEFAULT_PRESETS: AppPreset[] = [
  {
    id: 'builtin-evening-warm',
    name: 'Evening Warm',
    builtIn: true,
    rawPayload: '{"e":[{"fxnc":1,"fx":"Fader","speed":20,"color":[{"i":1,"c":"ww"},{"i":2,"c":"ww"}]},{"fxnc":2,"fx":"Fader","speed":20,"color":[{"i":1,"c":"ww"},{"i":2,"c":"ww"}]}]}',
  },
  {
    id: 'builtin-daylight',
    name: 'Daylight',
    builtIn: true,
    rawPayload: '{"e":[{"fxnc":1,"fx":"Fixed Colors","color":[{"i":1,"c":"cw"},{"i":2,"c":"cw"}]},{"fxnc":2,"fx":"Fixed Colors","color":[{"i":1,"c":"cw"},{"i":2,"c":"cw"}]}]}',
  },
  {
    id: 'builtin-night-mode',
    name: 'Night Mode',
    builtIn: true,
    rawPayload: '{"e":[{"fxnc":1,"fx":"Fixed Colors","color":[{"i":1,"c":"ww"}]},{"fxnc":2,"fx":"Fixed Colors","color":[{"i":1,"c":"ww"}]}],"mint":20}',
  },
  {
    id: 'builtin-party',
    name: 'Party',
    builtIn: true,
    rawPayload: '{"e":[{"fxnc":1,"fx":"Chase","speed":80,"color":[{"i":1,"c":"#ff0000"},{"i":2,"c":"#00ff00"},{"i":3,"c":"#0000ff"},{"i":4,"c":"#ffff00"}]},{"fxnc":2,"fx":"Sparkle","speed":80,"amount":5,"color":[{"c":"#ff00ff"}]}]}',
  },
  {
    id: 'builtin-relax',
    name: 'Relaxation',
    builtIn: true,
    rawPayload: '{"e":[{"fxnc":1,"fx":"Glow","speed":15,"color":[{"i":1,"c":"#4400aa"},{"i":2,"c":"#0044ff"}]},{"fxnc":2,"fx":"Fader","speed":10,"color":[{"i":1,"c":"#220055"},{"i":2,"c":"#0022aa"}]}]}',
  },
  {
    id: 'builtin-sunset',
    name: 'Sunset',
    builtIn: true,
    rawPayload: '{"e":[{"fxnc":1,"fx":"Blend","speed":8,"color":[{"i":1,"c":"#ff4400"},{"i":2,"c":"#ff8800"},{"i":3,"c":"#ffaa00"},{"i":4,"c":"#ff2200"}]},{"fxnc":2,"fx":"Fader","speed":12,"color":[{"i":1,"c":"#ff4400"},{"i":2,"c":"#ff8800"}]}]}',
  },
  {
    id: 'builtin-ocean',
    name: 'Ocean',
    builtIn: true,
    rawPayload: '{"e":[{"fxnc":1,"fx":"Wave","speed":25,"color":[{"i":1,"c":"#0055ff"},{"i":2,"c":"#00aaff"},{"i":3,"c":"#00ffcc"}]},{"fxnc":2,"fx":"Blend","speed":15,"color":[{"i":1,"c":"#003399"},{"i":2,"c":"#0066ff"}]}]}',
  },
  {
    id: 'builtin-off',
    name: 'All Off',
    builtIn: true,
    rawPayload: '{"mint":0}',
  },
];
