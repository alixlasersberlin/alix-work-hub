import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import logoAsset from '@/assets/alix-lasers-logo-gold-new.png.asset.json';

interface DoneState {
  request_number?: string;
  product_name?: string;
  image_url?: string | null;
  monthly?: number | null;
  currency?: string;
  term?: number;
}

export default function PublicMietanfrageErfolg() {
  const { state } = useLocation() as { state: DoneState | null };

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-lock-template', 'premium');
    html.setAttribute('data-public-wizard', '1');
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    return () => {
      html.removeAttribute('data-lock-template');
      html.removeAttribute('data-public-wizard');
      meta.remove();
    };
  }, []);

  const money = (v?: number | null) =>
    v === null || v === undefined
      ? null
      : Number(v).toLocaleString('de-DE', { style: 'currency', currency: state?.currency || 'EUR', maximumFractionDigits: 0 });

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-gradient-to-b from-[#fdfdfc] via-[#f5f6f7] to-[#eceef1] !text-slate-900">
      <header className="px-4 sm:px-6 md:px-10 py-4 sm:py-5 md:py-6">
        <img src={logoAsset.url} alt="ALIX Lasers" className="h-7 sm:h-8 md:h-9 w-auto" />
      </header>

      <main className="flex-1 px-4 sm:px-6 md:px-10 pb-20">
        <section className="mx-auto max-w-2xl text-center py-12 md:py-20 animate-in fade-in duration-700">
          <div className="mx-auto h-16 w-16 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-[0_25px_60px_-35px_rgba(15,23,42,0.5)]">
            <Check className="h-7 w-7 text-slate-800" />
          </div>
          <h1 className="!text-slate-900 mt-8 text-3xl md:text-5xl font-light tracking-tight">Vielen Dank für Ihre Mietanfrage</h1>
          <p className="mt-5 !text-slate-500 font-light">
            Ihre Anfrage ist bei uns eingegangen. Unser Team prüft sie und meldet sich zeitnah bei Ihnen.
          </p>

          {state?.request_number && (
            <div className="mt-8 inline-block rounded-2xl border !border-slate-200 bg-white/85 px-6 py-4">
              <p className="text-[10px] tracking-[0.28em] uppercase !text-slate-500">Ihre Anfragenummer</p>
              <p className="mt-1 text-xl font-light tracking-[0.1em] text-slate-900">{state.request_number}</p>
            </div>
          )}

          {state?.product_name && (
            <div className="mt-6 rounded-2xl border !border-slate-200 bg-white/85 p-5 flex items-center gap-4 text-left">
              {state.image_url && <img src={state.image_url} alt={state.product_name} className="h-16 w-16 object-contain" />}
              <div>
                <p className="text-slate-900 font-light">{state.product_name}</p>
                <p className="text-[13px] !text-slate-500 font-light">
                  {money(state.monthly) ? `${money(state.monthly)} / Monat` : 'Preis auf Anfrage'}
                  {state.term ? ` · ${state.term} Monate` : ''}
                </p>
              </div>
            </div>
          )}

          <p className="mt-8 text-[13px] !text-slate-500 font-light">
            Dies ist eine unverbindliche Mietanfrage und noch kein Mietvertrag. Eine Bestätigung haben wir Ihnen per E-Mail gesendet.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://www.alix-lasers.de"
              className="h-12 inline-flex items-center px-6 rounded-full bg-slate-900 text-white text-[12px] tracking-[0.2em] uppercase hover:bg-slate-800 transition"
            >
              Zur Webseite
            </a>
            <Link
              to="/miete/premium"
              className="h-12 inline-flex items-center px-6 rounded-full border border-slate-200 bg-white !text-slate-600 text-[12px] tracking-[0.2em] uppercase hover:!text-slate-900 transition"
            >
              Weitere Anfrage
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
