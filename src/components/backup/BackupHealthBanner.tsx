import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fullBackupOverdue } from '@/lib/backup/progress';

/** Admin-only dashboard warning when no full backup succeeded within 24 hours. */
export function BackupHealthBanner() {
  const { isAdmin } = useAuth();
  const { data, isSuccess } = useQuery({
    queryKey: ['backup-health-last-success'],
    enabled: isAdmin,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backups_metadata')
        .select('completed_at')
        .eq('backup_status', 'success')
        .eq('backup_scope', 'full')
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.completed_at ?? null;
    },
  });
  if (!isAdmin || !isSuccess || !fullBackupOverdue(data)) return null;
  return (
    <div className="mx-4 mt-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1">
        <div className="font-medium text-destructive">Keine erfolgreiche Vollsicherung in den letzten 24 Stunden</div>
        <div className="text-muted-foreground">
          Letzte erfolgreiche Vollsicherung: {data ? new Date(data).toLocaleString('de-DE') : 'keine vorhanden'}.{' '}
          <Link to="/datensicherung" className="underline">Datensicherung öffnen</Link>
        </div>
      </div>
    </div>
  );
}
