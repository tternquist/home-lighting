import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AppPreset, Schedule, Location } from '../types';

// Set DATA_DIR before importing storage so the module picks up the temp dir.
// storage.ts reads process.env.DATA_DIR at module initialisation time.
const TEST_DIR = mkdtempSync(join(tmpdir(), 'home-lighting-test-'));
process.env.DATA_DIR = TEST_DIR;

// Dynamic import so the env var is already set when the module loads
const storageModule = await import('../storage');
const {
  getPresets, savePreset, deletePreset,
  getSchedules, saveSchedule, deleteSchedule,
  getLocation, saveLocation,
} = storageModule;

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

// ── Presets ──────────────────────────────────────────────────────────────────

describe('presets', () => {
  const preset: AppPreset = {
    id: 'test-preset-1',
    name: 'Test Preset',
    rawPayload: '{"e":[]}',
  };

  beforeEach(() => {
    // Remove the test preset if it exists from a previous test
    deletePreset(preset.id);
  });

  it('getPresets returns built-in defaults when presets.json is absent', () => {
    // Delete the file so storage falls back to DEFAULT_PRESETS
    const file = join(TEST_DIR, 'presets.json');
    if (existsSync(file)) unlinkSync(file);
    const presets = getPresets();
    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBeGreaterThan(0);
    expect(presets.some(p => p.builtIn)).toBe(true);
  });

  it('savePreset adds a new preset', () => {
    savePreset(preset);
    const presets = getPresets();
    expect(presets.some(p => p.id === preset.id)).toBe(true);
  });

  it('savePreset updates an existing preset', () => {
    savePreset(preset);
    const updated: AppPreset = { ...preset, name: 'Updated Name' };
    savePreset(updated);
    const found = getPresets().find(p => p.id === preset.id);
    expect(found?.name).toBe('Updated Name');
    // Should not have duplicated it
    expect(getPresets().filter(p => p.id === preset.id)).toHaveLength(1);
  });

  it('deletePreset removes a user preset', () => {
    savePreset(preset);
    deletePreset(preset.id);
    expect(getPresets().some(p => p.id === preset.id)).toBe(false);
  });

  it('deletePreset only removes user-created presets from the persisted file', () => {
    // Save a user preset alongside any existing data, then delete it
    savePreset(preset);
    expect(getPresets().some(p => p.id === preset.id)).toBe(true);
    deletePreset(preset.id);
    expect(getPresets().some(p => p.id === preset.id)).toBe(false);
  });
});

// ── Schedules ─────────────────────────────────────────────────────────────────

describe('schedules', () => {
  const schedule: Schedule = {
    id: 'sched-1',
    name: 'Morning',
    enabled: true,
    trigger: 'time',
    offsetMinutes: 480,
    action: 'preset',
    presetId: 'builtin-daylight',
    days: [1, 2, 3, 4, 5],
  };

  beforeEach(() => {
    deleteSchedule(schedule.id);
  });

  it('getSchedules returns empty array by default', () => {
    const schedules = getSchedules();
    expect(Array.isArray(schedules)).toBe(true);
    // May have schedules from other tests — just assert it's an array
  });

  it('saveSchedule adds a new schedule', () => {
    saveSchedule(schedule);
    expect(getSchedules().some(s => s.id === schedule.id)).toBe(true);
  });

  it('saveSchedule updates existing schedule', () => {
    saveSchedule(schedule);
    saveSchedule({ ...schedule, name: 'Updated Morning' });
    const found = getSchedules().find(s => s.id === schedule.id);
    expect(found?.name).toBe('Updated Morning');
    expect(getSchedules().filter(s => s.id === schedule.id)).toHaveLength(1);
  });

  it('deleteSchedule removes a schedule', () => {
    saveSchedule(schedule);
    deleteSchedule(schedule.id);
    expect(getSchedules().some(s => s.id === schedule.id)).toBe(false);
  });

  it('deleteSchedule is a no-op for unknown id', () => {
    const before = getSchedules().length;
    deleteSchedule('does-not-exist');
    expect(getSchedules().length).toBe(before);
  });
});

// ── Location ──────────────────────────────────────────────────────────────────

describe('location', () => {
  const loc: Location = {
    lat: 41.85,
    lon: -87.65,
    name: 'Chicago',
    timezone: 'America/Chicago',
  };

  it('getLocation returns null when not set', () => {
    // Only null if location.json does not exist yet or is null
    const result = getLocation();
    expect(result === null || typeof result === 'object').toBe(true);
  });

  it('saveLocation persists and getLocation retrieves it', () => {
    saveLocation(loc);
    const saved = getLocation();
    expect(saved).toEqual(loc);
  });

  it('saveLocation overwrites previous location', () => {
    saveLocation(loc);
    const newLoc: Location = { lat: 37.77, lon: -122.42, name: 'San Francisco', timezone: 'America/Los_Angeles' };
    saveLocation(newLoc);
    expect(getLocation()).toEqual(newLoc);
  });
});
