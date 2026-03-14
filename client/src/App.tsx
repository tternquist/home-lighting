import { useEffect, useRef, useState } from 'react';
import { LightingState } from './types';
import Dashboard from './components/Dashboard';
import HomeKitPage from './components/HomeKitPage';
import SettingsPage from './components/SettingsPage';

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

export default function App() {
  const [state, setState] = useState<LightingState | null>(null);
  const [connected, setConnected] = useState(false);
  const [page, setPage] = useState('dashboard');
  const wsRef = useRef<WebSocket | null>(null);
  // Suppress WebSocket updates briefly after a local mutation to avoid flicker
  const suppressUntil = useRef(0);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };
      ws.onmessage = e => {
        if (Date.now() < suppressUntil.current) return;
        const msg = JSON.parse(e.data as string) as { type: string; data: LightingState };
        if (msg.type === 'state') setState(msg.data);
      };
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  function mutate(updater: (s: LightingState) => LightingState) {
    suppressUntil.current = Date.now() + 1500;
    setState(prev => (prev ? updater(prev) : prev));
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {page === 'homekit' ? (
        <HomeKitPage onBack={() => setPage('dashboard')} />
      ) : page === 'settings' ? (
        <SettingsPage onBack={() => setPage('dashboard')} />
      ) : state ? (
        <Dashboard state={state} mutate={mutate} connected={connected} onNavigate={setPage} />
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-sm">Connecting to controller…</p>
          </div>
        </div>
      )}
    </div>
  );
}
