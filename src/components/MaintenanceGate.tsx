import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MaintenanceState {
  enabled: boolean;
  message: string;
}

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, hasRole, signOut, loading: authLoading, roles } = useAuth();
  const [state, setState] = useState<MaintenanceState | null>(null);

  const isSuperAdmin = hasRole('Super Admin');
  const rolesReady = !authLoading && (!user || roles.length > 0);

  useEffect(() => {
    let cancelled = false;

    const fetchState = async () => {
      const { data } = await supabase
        .from('system_maintenance')
        .select('enabled, message')
        .eq('id', true)
        .maybeSingle();
      if (cancelled) return;
      setState({
        enabled: !!data?.enabled,
        message: data?.message ?? 'Das System befindet sich aktuell in Wartung.',
      });
    };

    fetchState();

    const channel = supabase
      .channel('system_maintenance_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_maintenance' },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (!row) return;
          setState({
            enabled: !!row.enabled,
            message: row.message ?? '',
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Wenn Wartung aktiv und User eingeloggt (kein Super Admin) → abmelden
  useEffect(() => {
    if (state?.enabled && user && rolesReady && !isSuperAdmin) {
      signOut().catch(() => { /* noop */ });
    }
  }, [state?.enabled, user, isSuperAdmin, rolesReady, signOut]);

  if (state?.enabled && rolesReady && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-lg w-full rounded-2xl border border-border bg-card shadow-2xl p-8 text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Wrench className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold">Systemwartung</h1>
          <p className="text-muted-foreground whitespace-pre-line">
            {state.message}
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Erneut prüfen
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
