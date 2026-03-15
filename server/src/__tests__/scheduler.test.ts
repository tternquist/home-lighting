import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerMinute } from '../scheduler';
import { Schedule, Location } from '../types';

// scheduler.ts imports suncalc — keep the real module for deterministic sun times
// but we need to prevent the cron job from starting
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
}));

vi.mock('../storage', () => ({
  getSchedules: vi.fn(() => []),
  getLocation: vi.fn(() => null),
}));

// Use a UTC+0 location (null island) so getHours() == local hours regardless of server TZ
const BASE_LOC: Location = {
  lat: 0.0,
  lon: 0.0,
  name: 'Null Island',
  timezone: 'UTC',
};

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'test-1',
    name: 'Test',
    enabled: true,
    trigger: 'time',
    offsetMinutes: 480, // 08:00
    action: 'preset',
    days: [],
    ...overrides,
  };
}

describe('triggerMinute — time trigger', () => {
  it('returns offsetMinutes directly for time trigger', () => {
    const s = makeSchedule({ trigger: 'time', offsetMinutes: 480 });
    const result = triggerMinute(s, null, new Date());
    expect(result).toBe(480);
  });

  it('returns 0 for midnight', () => {
    const s = makeSchedule({ trigger: 'time', offsetMinutes: 0 });
    expect(triggerMinute(s, null, new Date())).toBe(0);
  });

  it('returns 1439 for 23:59', () => {
    const s = makeSchedule({ trigger: 'time', offsetMinutes: 1439 });
    expect(triggerMinute(s, null, new Date())).toBe(1439);
  });

  it('ignores location for time trigger', () => {
    const s = makeSchedule({ trigger: 'time', offsetMinutes: 600 });
    expect(triggerMinute(s, BASE_LOC, new Date())).toBe(600);
    expect(triggerMinute(s, null, new Date())).toBe(600);
  });
});

describe('triggerMinute — sunrise/sunset trigger', () => {
  // Use a date with predictable sun times in Chicago (summer solstice area)
  const summerDate = new Date('2025-06-21T12:00:00Z');

  it('returns null when no location is provided', () => {
    const s = makeSchedule({ trigger: 'sunrise', offsetMinutes: 0 });
    expect(triggerMinute(s, null, summerDate)).toBeNull();
  });

  it('returns a minute value in range [0, 1439] for sunrise', () => {
    const s = makeSchedule({ trigger: 'sunrise', offsetMinutes: 0 });
    const result = triggerMinute(s, BASE_LOC, summerDate);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(0);
    expect(result!).toBeLessThanOrEqual(1439);
  });

  it('returns a minute value in range [0, 1439] for sunset', () => {
    const s = makeSchedule({ trigger: 'sunset', offsetMinutes: 0 });
    const result = triggerMinute(s, BASE_LOC, summerDate);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(0);
    expect(result!).toBeLessThanOrEqual(1439);
  });

  it('sunset is later than sunrise on the same day', () => {
    const sunrise = triggerMinute(makeSchedule({ trigger: 'sunrise', offsetMinutes: 0 }), BASE_LOC, summerDate);
    const sunset  = triggerMinute(makeSchedule({ trigger: 'sunset',  offsetMinutes: 0 }), BASE_LOC, summerDate);
    expect(sunset!).toBeGreaterThan(sunrise!);
  });

  it('applies positive offset to sunrise', () => {
    const base   = triggerMinute(makeSchedule({ trigger: 'sunrise', offsetMinutes: 0  }), BASE_LOC, summerDate);
    const offset = triggerMinute(makeSchedule({ trigger: 'sunrise', offsetMinutes: 30 }), BASE_LOC, summerDate);
    expect(offset!).toBe(base! + 30);
  });

  it('applies negative offset to sunset', () => {
    const base   = triggerMinute(makeSchedule({ trigger: 'sunset', offsetMinutes: 0   }), BASE_LOC, summerDate);
    const offset = triggerMinute(makeSchedule({ trigger: 'sunset', offsetMinutes: -30 }), BASE_LOC, summerDate);
    expect(offset!).toBe(base! - 30);
  });

  it('clamps result to 0 when offset makes it negative', () => {
    // offset of -1440 should clamp to 0
    const s = makeSchedule({ trigger: 'sunrise', offsetMinutes: -1440 });
    expect(triggerMinute(s, BASE_LOC, summerDate)).toBe(0);
  });

  it('clamps result to 1439 when offset goes past midnight', () => {
    const s = makeSchedule({ trigger: 'sunset', offsetMinutes: 1440 });
    expect(triggerMinute(s, BASE_LOC, summerDate)).toBe(1439);
  });
});
