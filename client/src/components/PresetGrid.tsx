import { useState } from 'react';
import { Preset } from '../types';
import { api } from '../api';

interface Props {
  presets: Preset[];
  onApplied: () => void;
  onSave: (name: string) => Promise<void>;
  onDelete: (id: string) => void;
}

export default function PresetGrid({ presets, onApplied, onSave, onDelete }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');

  async function handleApply(id: string) {
    setPending(id);
    setError(null);
    try {
      await api.applyPreset(id);
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPending(null);
    }
  }

  async function handleSave() {
    if (!saveName.trim()) return;
    await onSave(saveName.trim());
    setSaveName('');
    setSaving(false);
  }

  const wec3 = presets.filter(p => p.source === 'wec3');
  const app = presets.filter(p => p.source === 'app');

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm text-gray-200">Presets</h2>
        <button
          onClick={() => setSaving(s => !s)}
          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          {saving ? 'Cancel' : '+ Save current'}
        </button>
      </div>

      {saving && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Preset name…"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim()}
            className="px-4 py-2 bg-amber-400 text-gray-900 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-amber-300 transition-colors"
          >
            Save
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-xs bg-red-950/40 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Controller presets */}
      {wec3.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Controller</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {wec3.map(p => (
              <PresetButton key={p.id} preset={p} pending={pending} onApply={handleApply} />
            ))}
          </div>
        </div>
      )}

      {/* App presets */}
      {app.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Scenes</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {app.map(p => (
              <PresetButton
                key={p.id}
                preset={p}
                pending={pending}
                onApply={handleApply}
                onDelete={p.builtIn ? undefined : () => onDelete(p.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PresetButton({
  preset,
  pending,
  onApply,
  onDelete,
}: {
  preset: Preset;
  pending: string | null;
  onApply: (id: string) => void;
  onDelete?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const isPending = pending === preset.id;

  if (confirm) {
    return (
      <div className="bg-gray-800 rounded-xl p-2 flex flex-col gap-1">
        <p className="text-xs text-gray-400 text-center">Delete?</p>
        <div className="flex gap-1">
          <button onClick={() => { onDelete?.(); setConfirm(false); }}
            className="flex-1 py-1 bg-red-900 hover:bg-red-800 rounded-lg text-xs text-red-300">Yes</button>
          <button onClick={() => setConfirm(false)}
            className="flex-1 py-1 bg-gray-700 rounded-lg text-xs text-gray-400">No</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={() => onApply(preset.id)}
        disabled={pending !== null}
        className="w-full bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-xl px-3 py-3 transition-all text-center disabled:opacity-50"
      >
        <span className="text-sm text-gray-300">
          {isPending ? <span className="text-amber-400">Applying…</span> : preset.name}
        </span>
      </button>
      {onDelete && (
        <button
          onClick={() => setConfirm(true)}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-700 text-gray-500 text-xs hidden group-hover:flex items-center justify-center hover:bg-red-900 hover:text-red-300"
        >
          ✕
        </button>
      )}
    </div>
  );
}
