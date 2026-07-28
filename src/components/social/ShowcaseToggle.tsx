import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Copy as CopyIcon, ExternalLink, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export function SocialShowcaseToggle({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState<{ token: string | null; enabled: boolean }>({ token: null, enabled: false });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke('social-showcase-public', {
        body: { action: 'get_showcase_config', client_id: clientId },
      });
      if (data) setCfg({ token: (data as any).token ?? null, enabled: !!(data as any).enabled });
      setLoading(false);
    })();
  }, [clientId]);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('social-showcase-public', {
      body: { action: 'toggle_showcase', client_id: clientId, enabled },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setCfg({ token: (data as any).token ?? null, enabled: !!(data as any).enabled });
    toast.success(enabled ? 'Showcase aktiviert' : 'Showcase deaktiviert');
  };

  const url = cfg.token ? `https://alixwork.de/social/showcase/${cfg.token}` : '';

  if (loading) return <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />Showcase…</div>;

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-medium">Public Showcase</span>
          <span className="text-xs text-muted-foreground">— Referenzseite mit Lead-Formular</span>
        </div>
        <Switch checked={cfg.enabled} disabled={busy} onCheckedChange={toggle} />
      </div>
      {cfg.enabled && url && (
        <div className="flex items-center gap-2">
          <code className="text-xs bg-background border border-border rounded px-2 py-1 flex-1 truncate">{url}</code>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success('Link kopiert'); }}>
            <CopyIcon className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
          </Button>
        </div>
      )}
    </div>
  );
}
