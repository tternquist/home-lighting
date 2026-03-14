import { useEffect, useState } from 'react';
import { Schedule, Preset, Location } from '../types';
import { api } from '../api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Upcoming {
  scheduleId: string;
  name: string;
  time: string;
}

interface Props {
  presets: Preset[];
}

export default function SchedulePanel({ presets }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showLocation, setShowLocation] = useState(false);

  async function load() {
    const [s, u, l] = await Promise.all([
      api.getSchedules(),
      api.getUpcoming(),
      api.getLocation(),
    ]);
    setSchedules(s);
    setUpcoming(u);
    setLocation(l);
  }

  useEffect(() => { load(); }, []);

  async function toggleEnabled(schedule: Schedule) {
    const updated = { ...schedule, enabled: !schedule.enabled };
    await api.updateSchedule(schedule.id, updated);
    setSchedules(s => s.map(x => x.id === schedule.id ? updated : x));
    load(); // refresh upcoming
  }

  async function deleteSchedule(id: string) {
    await api.deleteSchedule(id);
    setSchedules(s => s.filter(x => x.id !== id));
    load();
  }

  async function saveSchedule(data: Omit<Schedule, 'id'> | Schedule) {
    if ('id' in data && data.id) {
      await api.updateSchedule(data.id, data);
    } else {
      await api.createSchedule(data);
    }
    setShowForm(false);
    setEditingSchedule(null);
    load();
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  function triggerLabel(s: Schedule) {
    if (s.trigger === 'time') {
      const h = Math.floor(s.offsetMinutes / 60);
      const m = s.offsetMinutes % 60;
      return `${h}:${String(m).padStart(2, '0')}`;
    }
    const offset = s.offsetMinutes === 0 ? '' : ` ${s.offsetMinutes > 0 ? '+' : ''}${s.offsetMinutes}m`;
    return `${s.trigger === 'sunrise' ? '🌅' : '🌇'} ${s.trigger}${offset}`;
  }

  function actionLabel(s: Schedule, presets: Preset[]) {
    if (s.action === 'off') return 'Turn off';
    if (s.action === 'brightness') return `Brightness ${s.brightness}%`;
    const p = presets.find(x => x.id === s.presetId);
    return p ? p.name : 'Apply preset';
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm text-gray-200">Schedules</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowLocation(true)}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            {location ? `📍 ${location.name}` : '📍 Set location'}
          </button>
          <button onClick={() => { setEditingSchedule(null); setShowForm(true); }}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
            + Add
          </button>
        </div>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="bg-gray-800/60 rounded-xl p-3 space-y-1">
          <p className="text-xs text-gray-500 mb-2">Upcoming</p>
          {upcoming.slice(0, 3).map((u, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-300">{u.name}</span>
              <span className="text-gray-500">{formatTime(u.time)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Schedule list */}
      {schedules.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-4">No schedules yet. Add one to automate your lights.</p>
      ) : (
        <div className="space-y-2">
          {schedules.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
              {/* Toggle */}
              <button
                onClick={() => toggleEnabled(s)}
                className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${s.enabled ? 'bg-amber-400' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${s.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-200 truncate">{s.name}</span>
                  {s.days.length > 0 && (
                    <span className="text-xs text-gray-500 shrink-0">
                      {s.days.map(d => DAYS[d]).join(', ')}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                  <span>{triggerLabel(s)}</span>
                  <span>→ {actionLabel(s, presets)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditingSchedule(s); setShowForm(true); }}
                  className="text-gray-500 hover:text-gray-300 text-xs px-1">✎</button>
                <button onClick={() => deleteSchedule(s.id)}
                  className="text-gray-500 hover:text-red-400 text-xs px-1">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule form modal */}
      {showForm && (
        <ScheduleForm
          initial={editingSchedule}
          presets={presets}
          hasLocation={!!location}
          onSave={saveSchedule}
          onClose={() => { setShowForm(false); setEditingSchedule(null); }}
        />
      )}

      {/* Location modal */}
      {showLocation && (
        <LocationForm
          current={location}
          onSave={async loc => { await api.saveLocation(loc); setLocation(loc); setShowLocation(false); load(); }}
          onClose={() => setShowLocation(false)}
        />
      )}
    </div>
  );
}

// ── Schedule form ─────────────────────────────────────────────────────────────

function ScheduleForm({
  initial, presets, hasLocation, onSave, onClose,
}: {
  initial: Schedule | null;
  presets: Preset[];
  hasLocation: boolean;
  onSave: (s: Omit<Schedule, 'id'> | Schedule) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [trigger, setTrigger] = useState<Schedule['trigger']>(initial?.trigger ?? 'sunset');
  const [offsetMinutes, setOffsetMinutes] = useState(initial?.offsetMinutes ?? 0);
  const [timeH, setTimeH] = useState(Math.floor((initial?.offsetMinutes ?? 18 * 60) / 60));
  const [timeM, setTimeM] = useState((initial?.offsetMinutes ?? 0) % 60);
  const [action, setAction] = useState<Schedule['action']>(initial?.action ?? 'preset');
  const [presetId, setPresetId] = useState(initial?.presetId ?? presets[0]?.id ?? '');
  const [brightness, setBrightness] = useState(initial?.brightness ?? 100);
  const [days, setDays] = useState<number[]>(initial?.days ?? []);

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  }

  async function handleSave() {
    const resolvedOffset = trigger === 'time' ? timeH * 60 + timeM : offsetMinutes;
    const data: Omit<Schedule, 'id'> = {
      name: name || `${trigger} schedule`,
      enabled: initial?.enabled ?? true,
      trigger,
      offsetMinutes: resolvedOffset,
      action,
      presetId: action === 'preset' ? presetId : undefined,
      brightness: action === 'brightness' ? brightness : undefined,
      days,
    };
    await onSave(initial ? { ...data, id: initial.id } : data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">{initial ? 'Edit Schedule' : 'New Schedule'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">✕</button>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Evening lights…"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400" />
        </div>

        {/* Trigger */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Trigger</label>
          <div className="flex gap-2">
            {(['sunrise', 'sunset', 'time'] as const).map(t => (
              <button key={t} onClick={() => setTrigger(t)}
                disabled={t !== 'time' && !hasLocation}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors capitalize disabled:opacity-30 ${trigger === t ? 'bg-amber-400 text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {t === 'sunrise' ? '🌅' : t === 'sunset' ? '🌇' : '🕐'} {t}
              </button>
            ))}
          </div>
          {!hasLocation && trigger !== 'time' && (
            <p className="text-xs text-amber-500 mt-1">Set your location to use sunrise/sunset</p>
          )}
        </div>

        {/* Offset / Time */}
        {trigger === 'time' ? (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Time</label>
            <div className="flex gap-2 items-center">
              <input type="number" min={0} max={23} value={timeH} onChange={e => setTimeH(parseInt(e.target.value) || 0)}
                className="w-16 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-amber-400" />
              <span className="text-gray-400">:</span>
              <input type="number" min={0} max={59} value={timeM} onChange={e => setTimeM(parseInt(e.target.value) || 0)}
                className="w-16 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-amber-400" />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Offset from {trigger}: {offsetMinutes > 0 ? '+' : ''}{offsetMinutes} min
            </label>
            <input type="range" min={-120} max={120} step={5} value={offsetMinutes}
              onChange={e => setOffsetMinutes(parseInt(e.target.value))}
              className="w-full" />
          </div>
        )}

        {/* Days */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Days (empty = every day)</label>
          <div className="flex gap-1">
            {DAYS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${days.includes(i) ? 'bg-amber-400 text-gray-900' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
                {d[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Action */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Action</label>
          <div className="flex gap-2 mb-2">
            {(['preset', 'brightness', 'off'] as const).map(a => (
              <button key={a} onClick={() => setAction(a)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors capitalize ${action === a ? 'bg-amber-400 text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {a}
              </button>
            ))}
          </div>
          {action === 'preset' && (
            <select value={presetId} onChange={e => setPresetId(e.target.value)}
              className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 border border-gray-700 focus:outline-none focus:border-amber-400">
              {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {action === 'brightness' && (
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={100} value={brightness}
                onChange={e => setBrightness(parseInt(e.target.value))}
                className="flex-1" />
              <span className="text-amber-400 font-mono text-sm w-10">{brightness}%</span>
            </div>
          )}
        </div>

        <button onClick={handleSave}
          className="w-full py-3 bg-amber-400 text-gray-900 rounded-xl font-semibold hover:bg-amber-300 transition-colors">
          {initial ? 'Update Schedule' : 'Create Schedule'}
        </button>
      </div>
    </div>
  );
}

// ── Location form ─────────────────────────────────────────────────────────────

function LocationForm({
  current, onSave, onClose,
}: {
  current: Location | null;
  onSave: (loc: Location) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(current?.name ?? '');
  const [lat, setLat] = useState(String(current?.lat ?? ''));
  const [lon, setLon] = useState(String(current?.lon ?? ''));
  const [tz, setTz] = useState(current?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const geoAvailable = typeof navigator !== 'undefined' && 'geolocation' in navigator
    && window.location.protocol === 'https:';

  function detect() {
    setDetecting(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude.toFixed(4));
        setLon(pos.coords.longitude.toFixed(4));
        setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
        setDetecting(false);
      },
      err => {
        setGeoError(err.message || 'Location access denied');
        setDetecting(false);
      },
      { timeout: 10000 }
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({ name: name || 'Home', lat: parseFloat(lat), lon: parseFloat(lon), timezone: tz });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Location</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">✕</button>
        </div>
        <p className="text-xs text-gray-400">Used to calculate local sunrise and sunset times.</p>

        {geoAvailable ? (
          <button onClick={detect} disabled={detecting}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 transition-colors disabled:opacity-50">
            {detecting ? 'Detecting…' : '📍 Use my current location'}
          </button>
        ) : (
          <p className="text-xs text-amber-500 bg-amber-950/40 rounded-xl px-3 py-2">
            Auto-detect requires HTTPS. Enter coordinates manually below — find yours at{' '}
            <span className="text-amber-300">latlong.net</span> or Google Maps (right-click → "What's here?").
          </p>
        )}

        {geoError && (
          <p className="text-xs text-red-400 bg-red-950/40 rounded-xl px-3 py-2">{geoError}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Latitude</label>
            <input value={lat} onChange={e => setLat(e.target.value)} placeholder="44.9778"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Longitude</label>
            <input value={lon} onChange={e => setLon(e.target.value)} placeholder="-93.2650"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Display name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Home"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Timezone <span className="text-gray-600">(IANA, e.g. America/Chicago)</span></label>
          <input value={tz} onChange={e => setTz(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400" />
        </div>

        {saveError && (
          <p className="text-xs text-red-400 bg-red-950/40 rounded-xl px-3 py-2">{saveError}</p>
        )}

        <button onClick={handleSave} disabled={!lat || !lon || saving}
          className="w-full py-3 bg-amber-400 text-gray-900 rounded-xl font-semibold hover:bg-amber-300 transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : 'Save Location'}
        </button>
      </div>
    </div>
  );
}
