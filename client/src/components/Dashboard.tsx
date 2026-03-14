import { useEffect, useState } from 'react';
import { LightingState, Preset } from '../types';
import { api } from '../api';
import { useDebounce } from '../hooks/useDebounce';
import ChannelCard from './ChannelCard';
import PresetGrid from './PresetGrid';
import SchedulePanel from './SchedulePanel';
import DebugLog from './DebugLog';

interface Props {
  state: LightingState;
  mutate: (updater: (s: LightingState) => LightingState) => void;
  connected: boolean;
  onNavigate: (page: string) => void;
}

export default function Dashboard({ state, mutate, connected, onNavigate }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const sendMasterBrightness = useDebounce((v: number) => api.masterBrightness(v), 120);

  async function loadPresets() {
    const p = await api.getPresets().catch(() => []);
    setPresets(p);
  }

  useEffect(() => { loadPresets(); }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Home Lighting</h1>
          <p className="text-xs text-gray-500">WEC3 · wec-e364</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('device')}
            className="text-gray-400 hover:text-white transition-colors"
            title="Device"
            aria-label="Device"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13 7H7v6h6V7z" />
              <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className="text-gray-400 hover:text-white transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => onNavigate('homekit')}
            className="text-gray-400 hover:text-white transition-colors"
            title="HomeKit Setup"
            aria-label="HomeKit Setup"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h4a1 1 0 001-1v-3h2v3a1 1 0 001 1h4a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">{connected ? 'Live' : 'Reconnecting…'}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-16 space-y-6">
        {/* Master brightness */}
        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <span className="font-medium">Master Brightness</span>
            <span className="text-amber-400 font-mono text-sm">{state.mint}%</span>
          </div>
          <input
            type="range" min={0} max={100} value={state.mint}
            onChange={e => {
              const mint = parseInt(e.target.value);
              mutate(s => ({ ...s, mint }));
              sendMasterBrightness(mint);
            }}
            className="w-full"
          />
        </div>

        {/* Channels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.e.map(ch => (
            <ChannelCard
              key={ch.fxn}
              channel={ch}
              onUpdate={updated =>
                mutate(s => ({ ...s, e: s.e.map(c => (c.fxn === updated.fxn ? updated : c)) }))
              }
            />
          ))}
        </div>

        {/* Presets */}
        <PresetGrid
          presets={presets}
          onApplied={loadPresets}
          onSave={async name => {
            await api.savePreset(name);
            await loadPresets();
          }}
          onDelete={async id => {
            await api.deletePreset(id);
            await loadPresets();
          }}
        />

        {/* Schedules */}
        <SchedulePanel presets={presets} />
      </main>

      <DebugLog />
    </div>
  );
}
