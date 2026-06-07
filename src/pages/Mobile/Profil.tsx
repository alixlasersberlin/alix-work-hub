import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MobileProfil() {
  const { profile, roles, signOut } = useAuth();
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Profil</h1>
      <Card className="p-4">
        <div className="font-semibold">{profile?.full_name || '—'}</div>
        <div className="text-sm text-muted-foreground">{profile?.email}</div>
        <div className="text-xs text-muted-foreground mt-2">Rollen: {roles.join(', ') || '—'}</div>
      </Card>
      <Card className="p-4 space-y-2 text-sm">
        <div className="font-semibold">Installation</div>
        <p className="text-muted-foreground">
          Diese App lässt sich auf dem Smartphone über das Browser-Menü („Zum Home-Bildschirm hinzufügen") wie eine native App installieren.
        </p>
      </Card>
      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link to="/"><ExternalLink className="w-4 h-4 mr-1" /> Desktop-App</Link>
        </Button>
        <Button onClick={signOut} variant="destructive" className="flex-1">
          <LogOut className="w-4 h-4 mr-1" /> Abmelden
        </Button>
      </div>
    </div>
  );
}
