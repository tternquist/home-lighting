import { Accessory, Bridge, Categories, Characteristic, CharacteristicValue, HAPStorage, Service, uuid } from 'hap-nodejs';
import path from 'path';
import * as wec from './wec';

const HAP_PIN = process.env.HAP_PIN || '031-45-154';
const HAP_PORT = parseInt(process.env.HAP_PORT || '47129');
const HAP_NAME = process.env.HAP_NAME || 'Home Lighting';
const PERSIST_PATH = path.resolve(__dirname, '../data/hap-persist');

// Track last non-zero brightness per channel (fxn 1 and 2)
const lastBrightness: Record<number, number> = {};
// Pending hue/saturation values waiting for debounce flush
const pendingHue: Record<number, number> = {};
const pendingSat: Record<number, number> = {};
const debounceTimers: Record<number, ReturnType<typeof setTimeout>> = {};

let _sendControl: (payload: object) => Promise<void>;
let _getState: () => wec.ControlState | null;

const channelServices: Record<number, Service> = {};

// ── Color helpers ──────────────────────────────────────────────────────────────

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  s /= 100; v /= 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function hexToHsv(hex: string): [number, number, number] {
  if (hex.startsWith('#')) hex = hex.slice(1);
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : Math.round((d / max) * 100);
  const v = Math.round(max * 100);
  return [h, s, v];
}

/** Map a WEC3 color value to HomeKit [hue, saturation]. */
export function colorToHs(c: string): [number, number] {
  if (c === 'ww') return [38, 30];
  if (c === 'cw') return [210, 10];
  if (c === 'none') return [0, 0];
  const [h, s] = hexToHsv(c);
  return [h, s];
}

/** Flush accumulated hue+saturation to the WEC3 after debounce. */
function flushColor(fxn: number): void {
  const h = pendingHue[fxn] ?? 0;
  const s = pendingSat[fxn] ?? 0;
  const [r, g, b] = hsvToRgb(h, s, 100);
  const hex = '#' + rgbToHex(r, g, b);
  _sendControl({ fxn, fx: 'Fixed Colors' })
    .then(() => _sendControl({ fxn, color: { i: 1, c: hex } }))
    .catch(err => console.error('[HomeKit] color flush error:', (err as Error).message));
}

// ── Accessory setup ────────────────────────────────────────────────────────────

function setupChannel(bridge: Bridge, fxn: number, name: string): void {
  const acc = new Accessory(name, uuid.generate(`home-lighting-channel-${fxn}`));

  const service = acc.addService(Service.Lightbulb, name);
  channelServices[fxn] = service;

  service.getCharacteristic(Characteristic.On)
    .onGet((): CharacteristicValue => {
      const ch = _getState()?.e.find(c => c.fxn === fxn);
      return (ch?.int ?? 0) > 0;
    })
    .onSet(async (value: CharacteristicValue) => {
      if (value) {
        await _sendControl({ fxn, int: lastBrightness[fxn] ?? 100 });
      } else {
        await _sendControl({ fxn, int: 0 });
      }
    });

  service.getCharacteristic(Characteristic.Brightness)
    .onGet((): CharacteristicValue => {
      const ch = _getState()?.e.find(c => c.fxn === fxn);
      return ch?.int ?? 0;
    })
    .onSet(async (value: CharacteristicValue) => {
      const bri = value as number;
      if (bri > 0) lastBrightness[fxn] = bri;
      await _sendControl({ fxn, int: bri });
    });

  service.getCharacteristic(Characteristic.Hue)
    .onGet((): CharacteristicValue => {
      const ch = _getState()?.e.find(c => c.fxn === fxn);
      const first = ch?.colors.find(c => c.c !== 'none');
      return first ? colorToHs(first.c)[0] : 0;
    })
    .onSet(async (value: CharacteristicValue) => {
      pendingHue[fxn] = value as number;
      clearTimeout(debounceTimers[fxn]);
      debounceTimers[fxn] = setTimeout(() => flushColor(fxn), 50);
    });

  service.getCharacteristic(Characteristic.Saturation)
    .onGet((): CharacteristicValue => {
      const ch = _getState()?.e.find(c => c.fxn === fxn);
      const first = ch?.colors.find(c => c.c !== 'none');
      return first ? colorToHs(first.c)[1] : 0;
    })
    .onSet(async (value: CharacteristicValue) => {
      pendingSat[fxn] = value as number;
      clearTimeout(debounceTimers[fxn]);
      debounceTimers[fxn] = setTimeout(() => flushColor(fxn), 50);
    });

  bridge.addBridgedAccessory(acc);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function init(
  sendControl: (payload: object) => Promise<void>,
  getState: () => wec.ControlState | null,
): void {
  _sendControl = sendControl;
  _getState = getState;

  HAPStorage.setCustomStoragePath(PERSIST_PATH);

  const bridge = new Bridge(HAP_NAME, uuid.generate(`home-lighting-bridge-${HAP_NAME}`));
  setupChannel(bridge, 1, 'Channel 1');
  setupChannel(bridge, 2, 'Channel 2');

  bridge.publish({
    username: '17:51:07:F4:BC:8A',
    port: HAP_PORT,
    pincode: HAP_PIN as `${string}-${string}-${string}`,
    category: Categories.BRIDGE,
  });

  console.log(`[HomeKit] Bridge "${HAP_NAME}" published on port ${HAP_PORT} — PIN: ${HAP_PIN}`);
}

export function notifyStateChange(state: wec.ControlState): void {
  for (const ch of state.e) {
    const service = channelServices[ch.fxn];
    if (!service) continue;

    service.getCharacteristic(Characteristic.On).updateValue(ch.int > 0);
    service.getCharacteristic(Characteristic.Brightness).updateValue(ch.int);

    const first = ch.colors.find(c => c.c !== 'none');
    if (first) {
      const [h, s] = colorToHs(first.c);
      service.getCharacteristic(Characteristic.Hue).updateValue(h);
      service.getCharacteristic(Characteristic.Saturation).updateValue(s);
    }
  }
}
