interface Props {
  color: string;
  index: number;
  active: boolean;
  onSelect: () => void;
}

function bg(c: string): string {
  if (c === 'ww') return '#FFECB3';
  if (c === 'cw') return '#E3F2FD';
  if (c === 'none') return 'transparent';
  return c;
}

export default function ColorSlot({ color, index, active, onSelect }: Props) {
  const isOff = color === 'none';
  const isWhite = color === 'ww' || color === 'cw';
  const label = color === 'ww' ? 'WW' : color === 'cw' ? 'CW' : '';

  return (
    <button
      onClick={onSelect}
      title={`Slot ${index + 1}: ${color === 'none' ? 'empty' : color}`}
      className={`relative w-11 h-11 rounded-lg border-2 transition-all flex items-center justify-center ${
        active
          ? 'border-amber-400 ring-2 ring-amber-400/30'
          : 'border-gray-700 hover:border-gray-500'
      } ${isOff ? 'border-dashed bg-gray-900' : ''}`}
      style={!isOff ? { backgroundColor: bg(color) } : undefined}
    >
      {isOff && <span className="text-gray-600 text-lg leading-none">+</span>}
      {isWhite && (
        <span className="text-[10px] font-bold text-gray-700 tracking-tight">{label}</span>
      )}
      <span className="absolute -top-1 -right-1 text-[9px] font-mono text-gray-500 bg-gray-900 rounded px-1 leading-tight">
        {index + 1}
      </span>
    </button>
  );
}
