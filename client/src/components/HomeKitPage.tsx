interface Props {
  onBack: () => void;
}

const PIN = '031-45-154';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-400 text-gray-950 flex items-center justify-center font-bold text-sm">
        {n}
      </div>
      <div className="pt-0.5">
        <p className="font-medium mb-1">{title}</p>
        <div className="text-gray-400 text-sm space-y-1">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
      <h2 className="font-semibold text-base">{title}</h2>
      {children}
    </div>
  );
}

export default function HomeKitPage({ onBack }: Props) {
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
          <h1 className="text-lg font-semibold tracking-tight">HomeKit Setup</h1>
          <p className="text-xs text-gray-500">Control lights from Home app &amp; Siri</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-16 space-y-6">

        {/* PIN callout */}
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-5 text-center">
          <p className="text-xs text-amber-400 uppercase tracking-widest font-medium mb-2">HomeKit Pairing Code</p>
          <p className="text-4xl font-mono font-bold tracking-widest text-amber-400">{PIN}</p>
          <p className="text-xs text-gray-500 mt-2">Enter this in the Home app when prompted</p>
        </div>

        {/* Setup steps */}
        <Section title="First-time Setup">
          <div className="space-y-5">
            <Step n={1} title="Open the Home app">
              <p>On your iPhone or iPad, open the <strong className="text-white">Home</strong> app.</p>
            </Step>
            <Step n={2} title="Add an accessory">
              <p>Tap the <strong className="text-white">+</strong> button in the top-right corner, then tap <strong className="text-white">Add Accessory</strong>.</p>
            </Step>
            <Step n={3} title="Enter the pairing code">
              <p>Tap <strong className="text-white">More options…</strong> or <strong className="text-white">I Don't Have a Code or Cannot Scan</strong>, then search for <strong className="text-white">Home Lighting</strong> on your local network.</p>
              <p>When prompted, enter the code above: <span className="font-mono text-white">{PIN}</span></p>
            </Step>
            <Step n={4} title="Accept the bridge">
              <p>Confirm adding <strong className="text-white">Home Lighting</strong>. HomeKit will then add two accessories:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li><strong className="text-white">Channel 1</strong> — LED channel 1</li>
                <li><strong className="text-white">Channel 2</strong> — LED channel 2</li>
              </ul>
            </Step>
            <Step n={5} title="Assign rooms &amp; name (optional)">
              <p>Follow the prompts to assign each light to a room and rename them to suit your space.</p>
            </Step>
          </div>
        </Section>

        {/* What you can control */}
        <Section title="What you can control">
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '💡', label: 'On / Off' },
              { icon: '☀️', label: 'Brightness' },
              { icon: '🎨', label: 'Color' },
              { icon: '🎙️', label: 'Siri voice control' },
              { icon: '⚡', label: 'Shortcuts &amp; Automations' },
              { icon: '🏠', label: 'Control Center tile' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-lg">{icon}</span>
                <span dangerouslySetInnerHTML={{ __html: label }} />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 pt-1">
            Picking a color in HomeKit switches the channel to <em>Fixed Colors</em> mode and updates color slot 1. Brightness and on/off work with any effect.
          </p>
        </Section>

        {/* Siri examples */}
        <Section title="Siri examples">
          <div className="space-y-2">
            {[
              'Hey Siri, turn off Channel 1',
              'Hey Siri, set Channel 2 to 50%',
              'Hey Siri, turn the lights blue',
              'Hey Siri, turn on the lights',
            ].map(cmd => (
              <p key={cmd} className="text-sm bg-gray-800 rounded-lg px-3 py-2 font-mono text-gray-200">
                "{cmd}"
              </p>
            ))}
          </div>
        </Section>

        {/* Re-pairing */}
        <Section title="Re-pairing / Troubleshooting">
          <div className="space-y-3 text-sm text-gray-400">
            <div>
              <p className="text-white font-medium mb-0.5">Accessories not appearing?</p>
              <p>Make sure your iPhone/iPad and the server are on the <strong className="text-white">same local network</strong>. HomeKit uses mDNS (Bonjour) for discovery — this won't work over VPN.</p>
            </div>
            <div>
              <p className="text-white font-medium mb-0.5">Need to re-pair?</p>
              <p>Remove the accessory from the Home app, then delete the pairing data on the server and restart:</p>
              <pre className="mt-1.5 bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">rm -rf server/data/hap-persist/</pre>
            </div>
            <div>
              <p className="text-white font-medium mb-0.5">Custom PIN or port?</p>
              <p>Set <code className="text-gray-200">HAP_PIN</code> and <code className="text-gray-200">HAP_PORT</code> environment variables before starting the server. Default port is <code className="text-gray-200">47129</code>.</p>
            </div>
          </div>
        </Section>

      </main>
    </div>
  );
}
