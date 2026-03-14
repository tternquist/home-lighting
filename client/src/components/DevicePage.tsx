import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useDebounce } from '../hooks/useDebounce';

interface Props {
  onBack: () => void;
}

interface DeviceConfig {
  ip: string; nm: string; gw: string;
  netfx: string; wcm: string; ssid: string;
  chip: number; conv: number; nout: number;
  t0h: number; t1h: number; tbit: number; tres: number;
  ports: Array<{ p: number; ts: number; l: number; rev: number }>;
}

interface DeviceStatus {
  status: { name: string; mod: string; mac: string; ver: string; sver: string; man: string };
}

interface SensorConfig {
  level: number; enabled: boolean;
  llon: number; lton: number;
  lsoff: number;
  lloff: number; ltoff: number; lmoff: number;
  pled: number;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-mono text-white">{value}</span>
    </div>
  );
}

function Card({ title, children, loading }: { title: string; children: React.ReactNode; loading?: boolean }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        {loading && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
      </div>
      {children}
    </div>
  );
}

export default function DevicePage({ onBack }: Props) {
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [sensor, setSensor] = useState<SensorConfig | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingSensor, setLoadingSensor] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const sendSensor = useDebounce((fields: object) => api.setDeviceSensor(fields), 300);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([
      api.getDeviceConfig().catch(() => null),
      fetch('/api/status').then(r => r.json()).catch(() => null),
    ]).then(([cfg, stat]) => {
      setConfig(cfg as DeviceConfig);
      setStatus(stat as DeviceStatus);
      setLoadingInfo(false);
    });

    api.getDeviceSensor().then(s => {
      setSensor(s as SensorConfig);
      setLoadingSensor(false);
    }).catch(() => setLoadingSensor(false));

    clockRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  function updateSensor(fields: Partial<Omit<SensorConfig, 'enabled' | 'level'>>) {
    setSensor(prev => prev ? { ...prev, ...fields } : prev);
    sendSensor(fields);
  }

  async function handleSyncClock() {
    setSyncing(true);
    try {
      const res = await api.syncClock() as { syncedAt: string };
      setSyncedAt(res.syncedAt);
    } finally {
      setSyncing(false);
    }
  }

  const totalLights = config?.ports.reduce((s, p) => s + p.l, 0) ?? 0;
  const wifiMode = config?.wcm === 'client' ? 'Network (Client)' : config?.wcm === 'ap' ? 'Direct (AP)' : config?.wcm ?? '—';
  const netFx = config?.netfx === 'none' ? 'None' : config?.netfx === 'master' ? 'Master' : config?.netfx === 'slave' ? 'Slave' : '—';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-5 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Device</h1>
          <p className="text-xs text-gray-500">{status?.status.name ?? 'WEC3 controller'}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-16 space-y-6">

        {/* Device info */}
        <Card title="Device Info" loading={loadingInfo}>
          {loadingInfo ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              <Row label="Model"        value={status?.status.mod ?? '—'} />
              <Row label="Firmware"     value={status?.status.sver ? `v${status.status.sver}` : '—'} />
              <Row label="MAC address"  value={status?.status.mac ?? '—'} />
              <Row label="IP address"   value={config?.ip ?? '—'} />
              <Row label="Gateway"      value={config?.gw ?? '—'} />
              <Row label="WiFi mode"    value={wifiMode} />
              <Row label="Network FX"   value={netFx} />
              <Row label="Outputs"      value={config?.nout ?? '—'} />
              <Row label="Total pixels" value={totalLights || '—'} />
              {config?.ports.map(p => (
                <Row key={p.p} label={`Port ${p.p}`}
                  value={`${p.l} lights · ${p.ts || 1} string${p.ts !== 1 ? 's' : ''}${p.rev ? ' · reversed' : ''}`} />
              ))}
              <Row label="LED chip"     value={`type ${config?.chip ?? '—'}`} />
              <Row label="Color order"  value={`conv ${config?.conv ?? '—'}`} />
              <Row label="Bit timing"   value={config ? `T0H ${config.t0h}ns · T1H ${config.t1h}ns · bit ${config.tbit}ns` : '—'} />
            </>
          )}
        </Card>

        {/* Clock sync */}
        <Card title="Controller Clock">
          <p className="text-sm text-gray-400 mb-3">
            The WEC3 has no NTP — it relies on an external push to stay accurate. The server syncs the clock automatically on startup.
          </p>
          <Row label="Server time" value={now.toLocaleTimeString()} />
          {syncedAt && <Row label="Last synced" value={new Date(syncedAt).toLocaleTimeString()} />}
          <div className="pt-3">
            <button
              onClick={handleSyncClock}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-gray-950 font-medium text-sm hover:bg-amber-300 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </Card>

        {/* Light sensor */}
        <Card title="Light Sensor" loading={loadingSensor}>
          {loadingSensor ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : !sensor ? (
            <p className="text-sm text-red-400">Failed to load sensor settings.</p>
          ) : (
            <div className="space-y-4">
              {/* Current level */}
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${sensor.level}%` }}
                  />
                </div>
                <span className="font-mono text-amber-400 text-sm w-12 text-right">{sensor.level}%</span>
                <span className="text-xs text-gray-500">ambient</span>
              </div>

              {/* Enable toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => {
                    const next = !sensor.enabled;
                    setSensor(prev => prev ? { ...prev, enabled: next } : prev);
                    api.setDeviceSensor({ lsp: next ? 1 : 0 });
                  }}
                  className={`relative w-10 h-6 rounded-full transition-colors ${sensor.enabled ? 'bg-amber-400' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${sensor.enabled ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm">Auto on/off using light sensor</span>
              </label>

              {sensor.enabled && (
                <div className="space-y-3 pl-2 border-l-2 border-gray-800">
                  {/* Turn ON */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Turn ON</p>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="text-gray-400">Below</span>
                      <input type="number" min={1} max={100} value={sensor.llon}
                        onChange={e => updateSensor({ llon: parseInt(e.target.value) })}
                        className="w-16 bg-gray-800 rounded-lg px-2 py-1 text-center font-mono" />
                      <span className="text-gray-400">% for</span>
                      <input type="number" min={1} max={6000} value={sensor.lton}
                        onChange={e => updateSensor({ lton: parseInt(e.target.value) })}
                        className="w-20 bg-gray-800 rounded-lg px-2 py-1 text-center font-mono" />
                      <span className="text-gray-400">seconds</span>
                    </div>
                  </div>

                  {/* Turn OFF mode */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Turn OFF</p>
                    <div className="flex gap-3">
                      {[
                        { val: 0, label: 'By level' },
                        { val: 1, label: 'By timer' },
                      ].map(opt => (
                        <label key={opt.val} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="radio" name="lsoff"
                            checked={sensor.lsoff === opt.val}
                            onChange={() => updateSensor({ lsoff: opt.val })}
                            className="accent-amber-400" />
                          {opt.label}
                        </label>
                      ))}
                    </div>

                    {sensor.lsoff === 0 ? (
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-gray-400">Above</span>
                        <input type="number" min={1} max={100} value={sensor.lloff}
                          onChange={e => updateSensor({ lloff: parseInt(e.target.value) })}
                          className="w-16 bg-gray-800 rounded-lg px-2 py-1 text-center font-mono" />
                        <span className="text-gray-400">% for</span>
                        <input type="number" min={1} max={6000} value={sensor.ltoff}
                          onChange={e => updateSensor({ ltoff: parseInt(e.target.value) })}
                          className="w-20 bg-gray-800 rounded-lg px-2 py-1 text-center font-mono" />
                        <span className="text-gray-400">seconds</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-gray-400">After</span>
                        <input type="number" min={1} max={90000} value={sensor.lmoff}
                          onChange={e => updateSensor({ lmoff: parseInt(e.target.value) })}
                          className="w-24 bg-gray-800 rounded-lg px-2 py-1 text-center font-mono" />
                        <span className="text-gray-400">minutes</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Power LED */}
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Power LED brightness</span>
                  <span className="text-sm font-mono text-amber-400">{sensor.pled}%</span>
                </div>
                <input type="range" min={1} max={100} value={sensor.pled}
                  onChange={e => updateSensor({ pled: parseInt(e.target.value) })}
                  className="w-full" />
              </div>
            </div>
          )}
        </Card>

      </main>
    </div>
  );
}
