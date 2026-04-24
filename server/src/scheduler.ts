import cron from 'node-cron';
import * as SunCalc from 'suncalc';
import { getSchedules, getLocation } from './storage';
import { child } from './logger';
import { Schedule, Location } from './types';

type ActionFn = (schedule: Schedule) => Promise<void>;

const log = child('scheduler');

let executeAction: ActionFn = async () => {};

export function init(fn: ActionFn) {
  executeAction = fn;

  // Check every minute
  cron.schedule('* * * * *', () => checkSchedules());
  log.info('scheduler started');
}

function getSunTime(trigger: 'sunrise' | 'sunset', loc: Location, date: Date): Date {
  const times = SunCalc.getTimes(date, loc.lat, loc.lon);
  return trigger === 'sunrise' ? times.sunrise : times.sunsetStart;
}

export function triggerMinute(schedule: Schedule, loc: Location | null, now: Date): number | null {
  if (schedule.trigger === 'time') {
    return schedule.offsetMinutes; // absolute minutes from midnight
  }
  if (!loc) return null;
  const base = getSunTime(schedule.trigger, loc, now);
  if (isNaN(base.getTime())) return null;
  const minutes = base.getHours() * 60 + base.getMinutes() + schedule.offsetMinutes;
  return Math.max(0, Math.min(1439, minutes));
}

function checkSchedules() {
  const now = new Date();
  const loc = getLocation();
  const dayOfWeek = now.getDay();
  const currentMinute = now.getHours() * 60 + now.getMinutes();

  for (const schedule of getSchedules()) {
    if (!schedule.enabled) continue;
    if (schedule.days.length > 0 && !schedule.days.includes(dayOfWeek)) continue;

    const target = triggerMinute(schedule, loc, now);
    if (target === null) continue;

    if (Math.round(target) === currentMinute) {
      log.info({ scheduleId: schedule.id, name: schedule.name, action: schedule.action }, 'firing schedule');
      executeAction(schedule).catch(err =>
        log.error({ err, scheduleId: schedule.id, name: schedule.name }, 'schedule execution failed')
      );
    }
  }
}

export function getUpcoming(count = 5): Array<{ schedule: Schedule; time: Date }> {
  const loc = getLocation();
  const now = new Date();
  const results: Array<{ schedule: Schedule; time: Date }> = [];

  for (const schedule of getSchedules()) {
    if (!schedule.enabled) continue;

    // Check today and tomorrow
    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      const dayOfWeek = date.getDay();

      if (schedule.days.length > 0 && !schedule.days.includes(dayOfWeek)) continue;

      const target = triggerMinute(schedule, loc, date);
      if (target === null) continue;

      const triggerDate = new Date(date);
      triggerDate.setHours(Math.floor(target / 60), target % 60, 0, 0);

      if (triggerDate > now) {
        results.push({ schedule, time: triggerDate });
        break;
      }
    }
  }

  return results
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .slice(0, count);
}
