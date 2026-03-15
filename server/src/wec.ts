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

// ── Device config ──────────────────────────────────────────────────────────────

export interface DeviceConfig {
  ip: string;
  nm: string;
  gw: string;
  netfx: string;
  wcm: string;
  ssid: string;
  univ: number;
  rap: number;
  chip: number;
  t0h: number;
  t1h: number;
  tbit: number;
  tres: number;
  conv: number;
  nout: number;
  ports: Array<{ p: number; ts: number; l: number; rev: number }>;
}

export async function getConfig(): Promise<DeviceConfig> {
  const res = await wecGet<{ config: DeviceConfig }>('/api/config');
  return res.config;
}

// ── Light sensor ───────────────────────────────────────────────────────────────

export interface LightSensorConfig {
  level: number;    // current ambient light %
  enabled: boolean; // auto on/off via sensor
  llon: number;     // turn ON below this %
  lton: number;     // ... for this many seconds
  lsoff: number;    // 0 = level-based off, 1 = timer-based off
  lloff: number;    // turn OFF above this %
  ltoff: number;    // ... after this many seconds
  lmoff: number;    // OR turn off after N minutes (timer mode)
  pled: number;     // power LED brightness 1–100
}

export async function getLightSensor(): Promise<LightSensorConfig> {
  const html = await wecGet<string>('/pconfig.html');

  function numField(id: string): number {
    const m = new RegExp(`id="${id}" value="(\\d+)"`).exec(html);
    return m ? parseInt(m[1]) : 0;
  }

  const lspTag = /<input[^>]*id="lsp"[^>]*>/.exec(html)?.[0] ?? '';
  const levelMatch = /currently (\d+)%/.exec(html);
  const lsoffTimerChecked = /name="lsoff" value="1"[^>]*\bchecked\b/.test(html);

  return {
    level:   levelMatch ? parseInt(levelMatch[1]) : 0,
    enabled: /\bchecked\b/.test(lspTag),
    llon:    numField('llon'),
    lton:    numField('lton'),
    lsoff:   lsoffTimerChecked ? 1 : 0,
    lloff:   numField('lloff'),
    ltoff:   numField('ltoff'),
    lmoff:   numField('lmoff'),
    pled:    numField('pled'),
  };
}

// ── Clock sync ────────────────────────────────────────────────────────────────

// Map IANA timezone identifiers to the WEC3's limited timezone set
const WEC_TZ_MAP: Record<string, string> = {
  'America/New_York':             'America/Eastern',
  'America/Detroit':              'America/Eastern',
  'America/Toronto':              'America/Eastern',
  'America/Indiana/Indianapolis': 'America/Eastern',
  'America/Chicago':              'America/Central',
  'America/Winnipeg':             'America/Central',
  'America/Denver':               'America/Mountain',
  'America/Edmonton':             'America/Mountain',
  'America/Boise':                'America/Mountain',
  'America/Phoenix':              'America/Arizona[MST]',
  'America/Los_Angeles':          'America/Pacific',
  'America/Vancouver':            'America/Pacific',
  'America/Anchorage':            'America/Alaska',
  'America/Halifax':              'America/Atlantic',
  'America/St_Johns':             'America/Newfoundland',
  'Asia/Hong_Kong':               'Asia/Hong_Kong',
  'Asia/Manila':                  'Asia/Philippine',
  'Asia/Seoul':                   'Asia/Korea',
  'Asia/Shanghai':                'Asia/China',
  'Asia/Taipei':                  'Asia/China',
  'Asia/Tokyo':                   'Asia/Japan',
  'Australia/Darwin':             'Australia/Central',
  'Australia/Sydney':             'Australia/Eastern',
  'Australia/Melbourne':          'Australia/Eastern',
  'Australia/Brisbane':           'Australia/Eastern_Standard',
  'Australia/Perth':              'Australia/Western',
  'Europe/London':                'Europe/GMT',
  'Europe/Dublin':                'Europe/GMT',
  'Europe/Paris':                 'Europe/Central',
  'Europe/Berlin':                'Europe/Central',
  'Europe/Rome':                  'Europe/Central',
  'Europe/Helsinki':              'Europe/Eastern',
  'Europe/Athens':                'Europe/Eastern',
  'Pacific/Auckland':             'Pacific/New_Zealand',
  'Pacific/Honolulu':             'Pacific/Hawaii',
};

export function toWecTz(iana: string): string {
  return WEC_TZ_MAP[iana] ?? 'Etc/Universal';
}

export async function syncClock(ianaTimezone?: string): Promise<void> {
  const now = new Date();
  const tz = toWecTz(ianaTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  await sendControl({
    year: now.getFullYear(),
    mon:  now.getMonth() + 1,
    day:  now.getDate(),
    hour: now.getHours(),
    min:  now.getMinutes(),
    sec:  now.getSeconds(),
    tz,
  });
}
