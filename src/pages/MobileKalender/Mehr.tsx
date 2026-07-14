import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Bell, LogOut, Settings2, ShieldCheck, Smartphone, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function KalenderMehr() {
  const { user, profile } = useAuth();
  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/'; };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"><User className="h-5 w-5 text-primary" /></div>
          <div>
            <div className="font-semibold">{(profile as any)?.full_name || user?.email}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </div>
        </div>
      </Card>

      <Tile to="/m/kalender/einstellungen" icon={Bell} title="Benachrichtigungen" desc="Push, Ruhezeiten, Kanäle" />
      <Tile to="/m/kalender/team" icon={Smartphone} title="Team & Auslastung" desc="Heutige Verteilung" />
      <Tile to="/dashboard" icon={Settings2} title="Zur Desktop-Ansicht" desc="Vollständiges AlixWork öffnen" />
      <Tile to="/sicherheit" icon={ShieldCheck} title="Sicherheit" desc="MFA, Geräte, Passwort" />

      <Button variant="outline" className="w-full mt-4" onClick={logout}>
        <LogOut className="h-4 w-4 mr-2" /> Abmelden
      </Button>

      <div className="text-[10px] text-center text-muted-foreground pt-4">
        AlixWork Kalender · Mobile PWA
      </div>
    </div>
  );
}

function Tile({ to, icon: Icon, title, desc }: any) {
  return (
    <Link to={to}>
      <Card className="p-3 flex items-center gap-3 hover:bg-secondary/50 transition">
        <Icon className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </Card>
    </Link>
  );
}
