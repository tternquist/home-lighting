const BASE = import.meta.env.VITE_API_URL || '';

async function req(method: string, path: string, body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

const get = (path: string) => req('GET', path);
const post = (path: string, body: object = {}) => req('POST', path, body);
const put = (path: string, body: object) => req('PUT', path, body);
const del = (path: string) => req('DELETE', path);

export const api = {
  // State
  masterBrightness: (brightness: number) => post('/api/master/brightness', { brightness }),
  channelEffect: (ch: number, effect: string) => post(`/api/channel/${ch}/effect`, { effect }),
  channelBrightness: (ch: number, brightness: number) => post(`/api/channel/${ch}/brightness`, { brightness }),
  channelColor: (ch: number, slot: number, color: string) => post(`/api/channel/${ch}/color/${slot}`, { color }),
  channelParam: (ch: number, name: string, value: string | number) => post(`/api/channel/${ch}/param`, { name, value }),

  // Presets
  getPresets: () => get('/api/presets'),
  applyPreset: (id: string) => post(`/api/presets/${id}/apply`),
  savePreset: (name: string) => post('/api/presets', { name }),
  deletePreset: (id: string) => del(`/api/presets/${id}`),

  // Schedules
  getSchedules: () => get('/api/schedules'),
  getUpcoming: () => get('/api/schedules/upcoming'),
  createSchedule: (s: object) => post('/api/schedules', s),
  updateSchedule: (id: string, s: object) => put(`/api/schedules/${id}`, s),
  deleteSchedule: (id: string) => del(`/api/schedules/${id}`),

  // Location
  getLocation: () => get('/api/location'),
  saveLocation: (loc: object) => put('/api/location', loc),
};
