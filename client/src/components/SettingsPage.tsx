import { useRef, useState } from 'react';
import { api } from '../api';

interface Props {
  onBack: () => void;
}

type ImportStatus = { type: 'success'; presets: number; schedules: number; location: boolean }
                  | { type: 'error'; message: string };

export default function SettingsPage({ onBack }: Props) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await api.exportSettings() as Record<string, unknown>;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `home-lighting-settings-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        presets?: unknown[];
        schedules?: unknown[];
        location?: unknown;
      };
      await api.importSettings(data);
      setImportStatus({
        type: 'success',
        presets: data.presets?.length ?? 0,
        schedules: data.schedules?.length ?? 0,
        location: !!data.location,
      });
    } catch (err) {
      setImportStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-5 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="text-xs text-gray-500">Export and import your configuration</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-16 space-y-6">

        {/* Export */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Export settings</h2>
          <p className="text-sm text-gray-400">
            Downloads a JSON file containing all your custom presets, schedules, and location. Built-in presets are not included.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-gray-950 font-medium text-sm hover:bg-amber-300 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            {exporting ? 'Exporting…' : 'Download settings.json'}
          </button>
        </div>

        {/* Import */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Import settings</h2>
          <p className="text-sm text-gray-400">
            Restore from a previously exported file. Custom presets are merged (existing presets with the same ID are overwritten). Schedules are replaced entirely. Location is updated if present in the file.
          </p>

          <label className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 text-sm font-medium cursor-pointer transition-colors w-fit ${importing ? 'opacity-50 pointer-events-none' : 'hover:border-gray-500 hover:text-white text-gray-300'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            {importing ? 'Importing…' : 'Choose file to import'}
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={handleFileChange}
              disabled={importing}
            />
          </label>

          {importStatus && (
            importStatus.type === 'success' ? (
              <div className="flex items-start gap-2 text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-xl px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>
                  Imported {importStatus.presets} preset{importStatus.presets !== 1 ? 's' : ''},{' '}
                  {importStatus.schedules} schedule{importStatus.schedules !== 1 ? 's' : ''}
                  {importStatus.location ? ', and location' : ''}.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{importStatus.message}</span>
              </div>
            )
          )}
        </div>

        {/* Format reference */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-widest">File format</h2>
          <pre className="text-xs text-gray-400 bg-gray-800 rounded-xl p-3 overflow-x-auto">{`{
  "version": "1",
  "exportedAt": "2026-03-14T00:00:00.000Z",
  "presets":   [ ...custom presets ],
  "schedules": [ ...schedules ],
  "location":  { "lat": 0, "lon": 0, "name": "", "timezone": "" }
}`}</pre>
        </div>

      </main>
    </div>
  );
}
