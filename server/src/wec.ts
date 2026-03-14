import axios from 'axios';

const WEC_BASE = process.env.WEC_URL || 'http://192.168.7.6';

export interface Color {
  c: string; // hex | 'ww' | 'cw' | 'none'
}

export interface ChannelState {
  fxn: number;
  fx: string;
  int: number;
  spd: number;
  trails: number;
  amount: number;
  spacing: number;
  dir: number;
  rot: number;
  colors: Color[];
}

export interface ControlState {
  mint: number;
  e: ChannelState[];
}

export interface DeviceStatus {
  status: {
    man: string;
    mod: string;
    mac: string;
    ver: string;
    sver: string;
    name: string;
    uuid: string;
  };
}

export interface Preset {
  index: number;
  name: string;
  rawPayload: string;
}

export interface LogEntry {
  ts: string;
  method: 'GET' | 'POST';
  path: string;
  payload?: object | string;
  status: number | 'error';
  ms: number;
  error?: string;
}

const log: LogEntry[] = [];

export function getLog(): LogEntry[] {
  return log;
}

function record(entry: LogEntry) {
  log.unshift(entry);
  if (log.length > 100) log.pop();
  const icon = entry.status === 'error' || (typeof entry.status === 'number' && entry.status >= 400) ? '✗' : '✓';
  const payload = entry.payload ? ' ' + JSON.stringify(entry.payload) : '';
  console.log(`[WEC3] ${icon} ${entry.method} ${entry.path}${payload} → ${entry.status} (${entry.ms}ms)`);
}

const client = axios.create({
  baseURL: WEC_BASE,
  timeout: 5000,
});

async function wecGet<T>(path: string): Promise<T> {
  const start = Date.now();
  try {
    const res = await client.get<T>(path);
    record({ ts: new Date().toISOString(), method: 'GET', path, status: res.status, ms: Date.now() - start });
    return res.data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    record({ ts: new Date().toISOString(), method: 'GET', path, status: 'error', ms: Date.now() - start, error: msg });
    throw err;
  }
}

// Send a JSON-serialisable object
async function wecPost(path: string, payload: object): Promise<void> {
  const start = Date.now();
  try {
    const res = await client.post(path, payload);
    record({ ts: new Date().toISOString(), method: 'POST', path, payload, status: res.status, ms: Date.now() - start });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    record({ ts: new Date().toISOString(), method: 'POST', path, payload, status: 'error', ms: Date.now() - start, error: msg });
    throw err;
  }
}

// Send a raw string body exactly as the WEC3 web UI does (some preset payloads are malformed JSON)
async function wecPostRaw(path: string, rawBody: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await client.post(path, rawBody, {
      headers: { 'Content-Type': 'text/plain' },
      transformRequest: [(data: string) => data],
    });
    record({ ts: new Date().toISOString(), method: 'POST', path, payload: rawBody, status: res.status, ms: Date.now() - start });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    record({ ts: new Date().toISOString(), method: 'POST', path, payload: rawBody, status: 'error', ms: Date.now() - start, error: msg });
    throw err;
  }
}

export async function getStatus(): Promise<DeviceStatus> {
  return wecGet('/api/status');
}

export async function getState(): Promise<ControlState> {
  return wecGet('/api/control');
}

export async function sendControl(payload: object): Promise<void> {
  return wecPost('/api/control', payload);
}

// Parse presets from the WEC3 HTML page — the controller stores them there
let cachedPresets: Preset[] = [];

export async function fetchPresets(): Promise<Preset[]> {
  const html = await wecGet<string>('/ppresets.html');
  const re = /onclick='bps\("p"\+(\d+),"((?:[^"\\]|\\.)*)"\)'>([^<]+)<\/button>/g;
  const presets: Preset[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    presets.push({
      index: parseInt(m[1]),
      name: m[3].trim(),
      // Unescape the HTML-attribute-escaped JSON string
      rawPayload: m[2].replace(/\\"/g, '"').replace(/\\'/g, "'"),
    });
  }
  cachedPresets = presets;
  return presets;
}

export function getCachedPresets(): Preset[] {
  return cachedPresets;
}

export async function applyPreset(index: number): Promise<void> {
  if (cachedPresets.length === 0) await fetchPresets();
  const preset = cachedPresets.find(p => p.index === index);
  if (!preset) throw new Error(`Preset ${index} not found`);
  return wecPostRaw('/api/control', preset.rawPayload);
}

export async function applyRaw(rawPayload: string): Promise<void> {
  return wecPostRaw('/api/control', rawPayload);
}
