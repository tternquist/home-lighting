import { useEffect, useState } from 'react';

interface LogEntry {
  ts: string;
  method: 'GET' | 'POST';
  path: string;
  payload?: object;
  status: number | 'error';
  ms: number;
  error?: string;
}

export default function DebugLog() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    function fetch_() {
      fetch('/api/debug/log')
        .then(r => r.json())
        .then(setEntries)
        .catch(() => {});
    }
    fetch_();
    const id = setInterval(fetch_, 2000);
    return () => clearInterval(id);
  }, [open]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full bg-gray-900 border-t border-gray-700 text-xs text-gray-500 hover:text-gray-300 py-1.5 text-center transition-colors"
      >
        {open ? '▼ Hide' : '▲ Debug log'}
      </button>

      {open && (
        <div className="bg-gray-950 border-t border-gray-800 h-56 overflow-y-auto font-mono text-xs">
          {entries.length === 0 && (
            <p className="text-gray-600 p-3">No log entries yet.</p>
          )}
          {entries.map((e, i) => {
            const ok = e.status !== 'error' && (typeof e.status !== 'number' || e.status < 400);
            return (
              <div
                key={i}
                className={`flex gap-3 px-3 py-1.5 border-b border-gray-900 ${ok ? '' : 'bg-red-950/40'}`}
              >
                <span className="text-gray-600 shrink-0">
                  {new Date(e.ts).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 w-10 ${ok ? 'text-green-400' : 'text-red-400'}`}>
                  {e.method}
                </span>
                <span className="text-gray-300 shrink-0">{e.path}</span>
                {e.payload && (
                  <span className="text-amber-300 truncate">{JSON.stringify(e.payload)}</span>
                )}
                <span className={`ml-auto shrink-0 ${ok ? 'text-gray-500' : 'text-red-400'}`}>
                  {e.error ?? e.status} {e.ms}ms
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
