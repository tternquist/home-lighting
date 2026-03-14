export interface Color {
  c: string;
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

export interface LightingState {
  mint: number;
  e: ChannelState[];
}

export interface Preset {
  id: string;
  name: string;
  source: 'wec3' | 'app';
  builtIn: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: 'sunrise' | 'sunset' | 'time';
  offsetMinutes: number;
  action: 'preset' | 'off' | 'brightness';
  presetId?: string;
  brightness?: number;
  days: number[];
}

export interface Location {
  lat: number;
  lon: number;
  name: string;
  timezone: string;
}
