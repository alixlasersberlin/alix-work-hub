import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, ExternalLink, Download, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function MobileProfil() {
  const { profile, roles, signOut } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const r = await installPrompt.userChoice;
    if (r?.outcome === 'accepted') toast.success('App wird installiert…');
    setInstallPrompt(null);
  };

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Profil</h1>

      <Card className="p-4 flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary grid place-items-center text-lg font-bold">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{profile?.full_name || '—'}</div>
          <div className="text-sm text-muted-foreground truncate">{profile?.email}</div>
          {roles?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {roles.map(r => (
                <span key={r} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-foreground">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Smartphone className="w-4 h-4 text-primary" /> Installation
        </div>
        {installed ? (
          <p className="text-sm text-muted-foreground">App ist installiert. Du nutzt Alix Mobile als eigenständige App.</p>
        ) : installPrompt ? (
          <>
            <p className="text-sm text-muted-foreground">Installiere Alix Mobile direkt auf dem Home-Bildschirm.</p>
            <Button onClick={install} className="w-full gold-gradient">
              <Download className="w-4 h-4 mr-2" /> Jetzt installieren
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tippe im Browser-Menü auf „Zum Home-Bildschirm hinzufügen", um die App zu installieren.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline">
          <Link to="/"><ExternalLink className="w-4 h-4 mr-1" /> Desktop</Link>
        </Button>
        <Button onClick={signOut} variant="destructive">
          <LogOut className="w-4 h-4 mr-1" /> Abmelden
        </Button>
      </div>

      <p className="text-center text-[10px] text-muted-foreground pt-2">Alix Mobile</p>
    </div>
  );
}
