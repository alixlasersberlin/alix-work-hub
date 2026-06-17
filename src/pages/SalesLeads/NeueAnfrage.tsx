import SalesWizard from '@/components/SalesWizard';

export default function NeueAnfrage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(120%_120%_at_0%_0%,#fdf6ec_0%,transparent_55%),radial-gradient(120%_120%_at_100%_100%,#eef2ff_0%,transparent_55%),linear-gradient(160deg,#ffffff_0%,#f7f6f2_60%,#eef0f5_100%)]">
      {/* Soft ambient blooms */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-[38rem] w-[38rem] rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-rose-100/40 blur-3xl" />
      </div>
      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] bg-[linear-gradient(transparent_95%,rgba(15,23,42,0.04)_95%),linear-gradient(90deg,transparent_95%,rgba(15,23,42,0.04)_95%)] bg-[size:42px_42px]"
      />

      <div className="relative z-10 px-4 sm:px-6 pt-6">
        <div className="mb-4 inline-flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-2.5 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <span className="h-2 w-2 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]" />
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">Neue Anfrage</h1>
            <p className="text-[11px] sm:text-xs text-slate-500">Alix Lasers® AI Sales Wizard</p>
          </div>
        </div>
        <SalesWizard />
      </div>
    </div>
  );
}
