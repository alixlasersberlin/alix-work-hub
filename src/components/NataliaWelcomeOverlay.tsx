import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const GIRLIE_SPRUECHE = [
  'Glitzer im Herzen, Sterne in den Augen ✨',
  'Heute mit extra Sparkle unterwegs 💕',
  'Be a cupcake in a world of muffins 🧁',
  'Behind every successful woman is herself 👑',
  'Stay wild, flower child 🌸',
  'Pink is not just a color, it’s an attitude 💖',
  'Du bist das Highlight des Tages 🌟',
  'Schmetterlinge im Bauch, Diamanten im Blick 🦋',
];

type FloatItem = { id: number; left: number; delay: number; duration: number; size: number; type: 'heart' | 'flower' | 'cloud'; drift: number };

function makeItems(): FloatItem[] {
  const items: FloatItem[] = [];
  let id = 0;
  const push = (type: FloatItem['type'], count: number, sizeRange: [number, number]) => {
    for (let i = 0; i < count; i++) {
      items.push({
        id: id++,
        left: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 8 + Math.random() * 10,
        size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
        drift: (Math.random() - 0.5) * 80,
        type,
      });
    }
  };
  push('heart', 22, [18, 42]);
  push('flower', 18, [22, 44]);
  push('cloud', 10, [60, 120]);
  return items;
}

function Heart({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 21s-7-4.35-9.5-8.5C.7 9.4 2.5 5 6.5 5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3 4 0 5.8 4.4 4 7.5C19 16.65 12 21 12 21z"
        fill="#ff4fa3" stroke="#ff8ec7" strokeWidth="1.2" />
    </svg>
  );
}

function Flower({ size }: { size: number }) {
  const colors = ['#ffb6e1', '#ff7ec0', '#ffd1f0', '#ff5ab1'];
  const c = colors[Math.floor(Math.random() * colors.length)];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      {[0, 72, 144, 216, 288].map(a => (
        <ellipse key={a} cx="20" cy="10" rx="6" ry="9" fill={c} transform={`rotate(${a} 20 20)`} opacity="0.95" />
      ))}
      <circle cx="20" cy="20" r="4.5" fill="#fff7c2" />
    </svg>
  );
}

function Cloud({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 120 72">
      <g fill="#cfe9ff" stroke="#b6dcff" strokeWidth="1.5">
        <ellipse cx="35" cy="48" rx="28" ry="20" />
        <ellipse cx="65" cy="36" rx="30" ry="24" />
        <ellipse cx="92" cy="50" rx="22" ry="18" />
      </g>
    </svg>
  );
}

export default function NataliaWelcomeOverlay() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const items = useMemo(() => makeItems(), [open]);
  const spruch = useMemo(() => GIRLIE_SPRUECHE[Math.floor(Math.random() * GIRLIE_SPRUECHE.length)], [open]);

  const isNatalia = (() => {
    const email = (user?.email || profile?.email || '').toLowerCase();
    const name = (profile?.full_name || '').toLowerCase();
    return email.startsWith('natalia.p@') || email.includes('natalia') || name.includes('natalia');
  })();

  useEffect(() => {
    if (!user || !isNatalia) return;
    const key = `natalia_overlay_session_${user.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    setOpen(true);
  }, [user, isNatalia]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden flex flex-col items-center justify-between py-12 px-6"
      style={{
        background:
          'radial-gradient(ellipse at top, #ffd1ec 0%, #ff8fcf 45%, #ff4fa3 100%)',
      }}
    >
      <style>{`
        @keyframes nat-float {
          0% { transform: translate(0,110vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translate(var(--drift,0px),-20vh) rotate(360deg); opacity: 0; }
        }
        @keyframes nat-cloud {
          0% { transform: translateX(-30vw); }
          100% { transform: translateX(130vw); }
        }
        @keyframes nat-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes nat-wiggle {
          0%,100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
      `}</style>

      {items.map(it => {
        if (it.type === 'cloud') {
          return (
            <div
              key={it.id}
              className="absolute pointer-events-none"
              style={{
                top: `${5 + Math.random() * 70}%`,
                left: 0,
                animation: `nat-cloud ${it.duration * 2}s linear ${it.delay}s infinite`,
                opacity: 0.85,
              }}
            >
              <Cloud size={it.size} />
            </div>
          );
        }
        return (
          <div
            key={it.id}
            className="absolute pointer-events-none"
            style={{
              left: `${it.left}%`,
              top: 0,
              ['--drift' as any]: `${it.drift}px`,
              animation: `nat-float ${it.duration}s linear ${it.delay}s infinite`,
            }}
          >
            {it.type === 'heart' ? <Heart size={it.size} /> : <Flower size={it.size} />}
          </div>
        );
      })}

      <div
        className="relative z-10 text-center"
        style={{ animation: 'nat-pop 0.8s ease-out both' }}
      >
        <h1
          className="font-extrabold tracking-tight drop-shadow-[0_4px_12px_rgba(255,0,120,0.45)]"
          style={{
            fontSize: 'clamp(2rem, 6vw, 4.5rem)',
            color: '#fff',
            textShadow: '0 2px 0 #ff4fa3, 0 6px 24px rgba(255,255,255,0.5)',
            fontFamily: '"Comic Sans MS", "Brush Script MT", cursive',
            animation: 'nat-wiggle 3s ease-in-out infinite',
          }}
        >
          HALLO LIEBES ✨
        </h1>
        <p
          className="mt-3 font-semibold"
          style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.8rem)',
            color: '#fff',
            textShadow: '0 2px 8px rgba(255,0,120,0.5)',
          }}
        >
          SCHÖN DICH HEUTE ZU SEHEN 💖
        </p>
      </div>

      <div
        className="relative z-10 flex flex-col items-center gap-6"
        style={{ animation: 'nat-pop 1s ease-out 0.2s both' }}
      >
        <p
          className="text-center font-medium px-4 py-2 rounded-full bg-white/40 backdrop-blur-sm"
          style={{
            color: '#a3005a',
            fontSize: 'clamp(0.95rem, 1.8vw, 1.25rem)',
            fontFamily: '"Comic Sans MS", cursive',
          }}
        >
          {spruch}
        </p>

        <button
          onClick={() => setOpen(false)}
          className="px-12 py-4 rounded-full font-extrabold uppercase tracking-wider text-white text-lg shadow-2xl hover:scale-110 active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #ff2d92 0%, #ff6fb5 50%, #ff2d92 100%)',
            boxShadow: '0 10px 30px rgba(255,45,146,0.6), inset 0 -4px 0 rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.4)',
            border: '3px solid #fff',
          }}
        >
          💕 Los geht’s 💕
        </button>
      </div>
    </div>
  );
}
