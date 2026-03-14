import { useRef, useState, useEffect } from 'react';

interface Props {
  color: string;
  index: number;
  onChange: (color: string) => void;
}

const SPECIAL = [
  { value: 'ww', label: 'Warm White', bg: '#FFECB3' },
  { value: 'cw', label: 'Cool White', bg: '#E3F2FD' },
  { value: 'none', label: 'Off', bg: 'transparent' },
];

function displayBg(c: string): string {
  if (c === 'ww') return '#FFECB3';
  if (c === 'cw') return '#E3F2FD';
  if (c === 'none') return 'transparent';
  return c;
}

export default function ColorSlot({ color, index, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isNone = color === 'none';
  const isSpecial = color === 'ww' || color === 'cw' || color === 'none';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title={`Color slot ${index + 1}: ${color}`}
        className={`w-9 h-9 rounded-lg border-2 transition-all ${
          open ? 'border-amber-400 scale-110' : 'border-gray-700 hover:border-gray-500'
        } ${isNone ? 'border-dashed' : ''}`}
        style={{ backgroundColor: displayBg(color) }}
      >
        {isNone && <span className="text-gray-600 text-xs">✕</span>}
      </button>

      {open && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-xl w-48">
          <p className="text-xs text-gray-400 mb-2">Slot {index + 1}</p>

          {/* Hex picker */}
          <div className="flex items-center gap-2 mb-3">
            <input
              type="color"
              value={isSpecial ? '#ffffff' : color}
              onChange={e => onChange(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="text-xs text-gray-300 font-mono">{isSpecial ? '—' : color}</span>
          </div>

          {/* Special options */}
          <div className="flex flex-col gap-1">
            {SPECIAL.map(s => (
              <button
                key={s.value}
                onClick={() => { onChange(s.value); setOpen(false); }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                  color === s.value
                    ? 'bg-amber-400/20 text-amber-300'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-sm border border-gray-600 flex-shrink-0"
                  style={{ backgroundColor: s.bg }}
                />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
