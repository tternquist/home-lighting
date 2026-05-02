import { useState, useEffect } from 'react';

interface Props {
  slot: number;
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}

const PALETTE: Array<{ hex: string; name: string }> = [
  { hex: '#ff0000', name: 'Red' },
  { hex: '#ff7f00', name: 'Orange' },
  { hex: '#ffff00', name: 'Yellow' },
  { hex: '#00ff00', name: 'Green' },
  { hex: '#00ffff', name: 'Cyan' },
  { hex: '#0000ff', name: 'Blue' },
  { hex: '#8000ff', name: 'Purple' },
  { hex: '#ff00ff', name: 'Magenta' },
  { hex: '#ff0080', name: 'Pink' },
  { hex: '#80ff00', name: 'Lime' },
  { hex: '#0080ff', name: 'Sky' },
  { hex: '#ff8080', name: 'Coral' },
];

function previewBg(c: string): string {
  if (c === 'ww') return '#FFECB3';
  if (c === 'cw') return '#E3F2FD';
  if (c === 'none') return 'transparent';
  return c;
}

function describe(c: string): string {
  if (c === 'ww') return 'Warm White';
  if (c === 'cw') return 'Cool White';
  if (c === 'none') return 'Empty';
  return c.toUpperCase();
}

export default function ColorPicker({ slot, color, onChange, onClose }: Props) {
  const isHex = color.startsWith('#');
  const [hexInput, setHexInput] = useState(isHex ? color : '#ffffff');

  useEffect(() => {
    if (color.startsWith('#')) setHexInput(color);
  }, [color]);

  function commitHex(v: string) {
    const trimmed = v.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
      onChange(withHash.toLowerCase());
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
      {/* Header with preview */}
      <div className="flex items-center gap-3">
        <div
          className={`w-12 h-12 rounded-lg border-2 ${
            color === 'none' ? 'border-dashed border-gray-600 bg-gray-900' : 'border-gray-600'
          }`}
          style={color !== 'none' ? { backgroundColor: previewBg(color) } : undefined}
        />
        <div className="flex-1">
          <p className="text-xs text-gray-400">Slot {slot + 1}</p>
          <p className="text-sm font-mono text-gray-200">{describe(color)}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 px-2 py-1 text-lg"
          aria-label="Close picker"
        >
          ×
        </button>
      </div>

      {/* Quick palette */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Colors</p>
        <div className="grid grid-cols-6 gap-2">
          {PALETTE.map(p => (
            <button
              key={p.hex}
              onClick={() => onChange(p.hex)}
              title={p.name}
              className={`w-full aspect-square rounded-lg border-2 transition-all ${
                color.toLowerCase() === p.hex
                  ? 'border-amber-400 scale-105'
                  : 'border-transparent hover:border-gray-500'
              }`}
              style={{ backgroundColor: p.hex }}
            />
          ))}
        </div>
      </div>

      {/* Whites */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Whites</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onChange('ww')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border-2 ${
              color === 'ww'
                ? 'border-amber-400 bg-amber-400/10 text-amber-200'
                : 'border-gray-700 text-gray-300 hover:border-gray-600'
            }`}
          >
            <span
              className="w-5 h-5 rounded border border-gray-600"
              style={{ backgroundColor: '#FFECB3' }}
            />
            Warm
          </button>
          <button
            onClick={() => onChange('cw')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border-2 ${
              color === 'cw'
                ? 'border-amber-400 bg-amber-400/10 text-amber-200'
                : 'border-gray-700 text-gray-300 hover:border-gray-600'
            }`}
          >
            <span
              className="w-5 h-5 rounded border border-gray-600"
              style={{ backgroundColor: '#E3F2FD' }}
            />
            Cool
          </button>
        </div>
      </div>

      {/* Custom hex */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Custom</p>
        <div className="flex items-center gap-2">
          <label className="relative w-10 h-10 rounded-lg border-2 border-gray-700 overflow-hidden cursor-pointer hover:border-gray-500 flex-shrink-0">
            <input
              type="color"
              value={isHex ? color : hexInput}
              onChange={e => onChange(e.target.value.toLowerCase())}
              className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
            />
            <span
              className="absolute inset-0"
              style={{ backgroundColor: isHex ? color : hexInput }}
            />
          </label>
          <input
            type="text"
            value={hexInput}
            onChange={e => setHexInput(e.target.value)}
            onBlur={e => commitHex(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                commitHex(e.currentTarget.value);
                e.currentTarget.blur();
              }
            }}
            placeholder="#rrggbb"
            spellCheck={false}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-200 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={() => onChange('none')}
        className={`w-full py-2 rounded-lg text-sm transition-colors border-2 border-dashed ${
          color === 'none'
            ? 'border-amber-400 text-amber-300 bg-amber-400/5'
            : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
        }`}
      >
        {color === 'none' ? 'Slot empty' : 'Remove color'}
      </button>
    </div>
  );
}
