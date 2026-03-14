export interface AppPreset {
  id: string;
  name: string;
  rawPayload: string;
  builtIn?: boolean; // true = ships with app, can't delete
}

export interface Schedule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: 'sunrise' | 'sunset' | 'time';
  offsetMinutes: number; // +/- minutes from trigger; absolute minutes-from-midnight for 'time'
  action: 'preset' | 'off' | 'brightness';
  presetId?: string;     // for action='preset'
  brightness?: number;   // for action='brightness'
  days: number[];        // 0=Sun … 6=Sat, empty = every day
}

export interface Location {
  lat: number;
  lon: number;
  name: string;
  timezone: string; // IANA timezone, e.g. 'America/Chicago'
}
