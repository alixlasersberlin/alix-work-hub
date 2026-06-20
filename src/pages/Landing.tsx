import { useEffect } from 'react';
import logoAsset from '@/assets/alix-logo-landing.png.asset.json';

/**
 * Öffentliche Landing-Page für https://alixwork.de/
 * Zeigt ausschließlich Logo + Claim. Keine Hinweise auf Login,
 * keine internen Links. Login erfolgt ausschließlich über die
 * verdeckten Routen (/alix-control etc.).
 */
export default function Landing() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Alix Work — Enterprise Management';
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-8 animate-fade-in">
        <img
          src={logoAsset.url}
          alt="Alix Lasers"
          className="h-24 md:h-32 w-auto object-contain select-none"
          draggable={false}
        />
        <h1 className="text-2xl md:text-3xl font-light tracking-[0.2em] text-primary text-center uppercase">
          Alix Work
          <span className="mx-3 text-muted-foreground">–</span>
          <span className="text-foreground">Enterprise Management</span>
        </h1>
      </div>
    </main>
  );
}
