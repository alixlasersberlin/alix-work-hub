import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';

type Item = { title: string; link: string };

export function CNNNewsTicker() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          'https://api.rss2json.com/v1/api.json?rss_url=' +
            encodeURIComponent('http://rss.cnn.com/rss/edition.rss')
        );
        const json = await res.json();
        if (!cancelled && Array.isArray(json?.items)) {
          setItems(
            json.items.slice(0, 15).map((i: any) => ({ title: i.title, link: i.link }))
          );
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const display = items.length
    ? items
    : [{ title: 'Lade aktuelle CNN-Nachrichten …', link: '#' }];

  // Doppelt für nahtlosen Loop
  const loop = [...display, ...display];

  return (
    <div className="relative flex items-center gap-3 rounded-xl border border-border bg-card overflow-hidden h-12">
      <style>{`
        @keyframes cnn-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .cnn-marquee-track {
          animation: cnn-marquee 90s linear infinite;
        }
        .cnn-marquee-wrapper:hover .cnn-marquee-track {
          animation-play-state: paused;
        }
      `}</style>
      <div className="flex items-center gap-1.5 pl-4 pr-3 h-full text-foreground text-[11px] font-bold uppercase tracking-wider flex-shrink-0 z-10 border-r border-border">
        <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
        CNN Live
      </div>
      <div className="cnn-marquee-wrapper flex-1 overflow-hidden">
        <div className="cnn-marquee-track flex whitespace-nowrap w-max">
          {loop.map((it, idx) => (
            <a
              key={idx}
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-foreground/90 hover:text-primary px-6 inline-flex items-center gap-3"
            >
              <span className="text-primary">●</span>
              {it.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
