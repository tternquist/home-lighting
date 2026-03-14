import { useState } from 'react';
import { ChannelState } from '../types';
import { api } from '../api';
import { useDebounce } from '../hooks/useDebounce';
import ColorSlot from './ColorSlot';

const EFFECTS = [
  'Bands', 'Bars', 'Blend', 'Chase', 'Circles', 'Color Change', 'Color Wave',
  'Expand', 'Fader', 'Fixed Colors', 'Glow', 'Lightning', 'Markers', 'Paint',
  'Ping Pong', 'Pulsate', 'Shift', 'Snow', 'Sparkle', 'Twist', 'Worms',
];

interface Props {
  channel: ChannelState;
  onUpdate: (ch: ChannelState) => void;
}

interface SliderRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, onChange }: SliderRowProps) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function ChannelCard({ channel, onUpdate }: Props) {
  const [showParams, setShowParams] = useState(false);
  const ch = channel.fxn;

  const sendBrightness = useDebounce((v: number) => api.channelBrightness(ch, v), 120);
  const sendSpd = useDebounce((v: number) => api.channelParam(ch, 'spd', v), 120);
  const sendTrails = useDebounce((v: number) => api.channelParam(ch, 'trails', v), 120);
  const sendSpacing = useDebounce((v: number) => api.channelParam(ch, 'spacing', v), 120);
  const sendAmount = useDebounce((v: number) => api.channelParam(ch, 'amount', v), 120);

  function update(patch: Partial<ChannelState>) {
    onUpdate({ ...channel, ...patch });
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-gray-200">Channel {ch}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-amber-400 font-mono">
          {channel.int}%
        </span>
      </div>

      {/* Effect selector */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Effect</label>
        <select
          value={channel.fx}
          onChange={e => {
            const fx = e.target.value;
            update({ fx });
            api.channelEffect(ch, fx);
          }}
          className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 border border-gray-700 focus:outline-none focus:border-amber-400"
        >
          {EFFECTS.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {/* Brightness */}
      <SliderRow
        label="Brightness"
        value={channel.int}
        onChange={v => {
          update({ int: v });
          sendBrightness(v);
        }}
      />

      {/* Colors */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Colors</p>
        <div className="flex gap-2 flex-wrap">
          {channel.colors.map((col, i) => (
            <ColorSlot
              key={i}
              index={i}
              color={col.c}
              onChange={color => {
                const colors = channel.colors.map((c, ci) => (ci === i ? { c: color } : c));
                update({ colors });
                api.channelColor(ch, i, color);
              }}
            />
          ))}
        </div>
      </div>

      {/* Params toggle */}
      <button
        onClick={() => setShowParams(v => !v)}
        className="w-full text-xs text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1 py-1 transition-colors"
      >
        <span>{showParams ? '▲' : '▼'}</span>
        <span>{showParams ? 'Hide' : 'Show'} parameters</span>
      </button>

      {showParams && (
        <div className="space-y-3 pt-1 border-t border-gray-800">
          <SliderRow
            label="Speed"
            value={channel.spd}
            onChange={v => { update({ spd: v }); sendSpd(v); }}
          />
          <SliderRow
            label="Trails"
            value={channel.trails}
            onChange={v => { update({ trails: v }); sendTrails(v); }}
          />
          <SliderRow
            label="Spacing"
            value={channel.spacing}
            onChange={v => { update({ spacing: v }); sendSpacing(v); }}
          />
          <SliderRow
            label="Amount"
            value={channel.amount}
            onChange={v => { update({ amount: v }); sendAmount(v); }}
          />

          {/* Direction & Rotation toggles */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => {
                const dir = channel.dir === 0 ? 1 : 0;
                update({ dir });
                api.channelParam(ch, 'dir', dir);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                channel.dir === 1
                  ? 'bg-amber-400/20 text-amber-300'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              ↔ Reverse
            </button>
            <button
              onClick={() => {
                const rot = channel.rot === 0 ? 1 : 0;
                update({ rot });
                api.channelParam(ch, 'rotate', rot);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                channel.rot === 1
                  ? 'bg-amber-400/20 text-amber-300'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              ↻ Rotate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
