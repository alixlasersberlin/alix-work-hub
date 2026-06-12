import SalesWizard from '@/components/SalesWizard';

export default function NeueAnfrage() {
  return (
    <div className="relative min-h-screen overflow-hidden p-6 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(217,70,239,0.18),transparent_55%),linear-gradient(160deg,#05070f_0%,#0a0f24_50%,#070b1a_100%)]">
      {/* Ambient AI orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-cyan-400/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl animate-pulse [animation-delay:2s]" />
      </div>
      {/* Grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 bg-[linear-gradient(transparent_95%,rgba(255,255,255,0.05)_95%),linear-gradient(90deg,transparent_95%,rgba(255,255,255,0.05)_95%)] bg-[size:42px_42px]"
      />
      {/* Watermark */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center select-none opacity-[0.04]">
        <div className="text-[18vw] font-black tracking-tighter text-white whitespace-nowrap">ALIX</div>
      </div>

      <div className="relative z-10">
        <div className="mb-6 inline-block rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(34,211,238,0.4)]">
          <h1 className="text-2xl font-semibold text-white">Neue Anfrage</h1>
          <p className="text-sm text-cyan-200/70">Alix Lasers® AI Sales Wizard – Anfrage manuell erfassen</p>
        </div>
        <SalesWizard />
      </div>
    </div>
  );
}
