import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2, RotateCcw } from 'lucide-react';

export function SoftDeleteButtons({ doc, onChange }: { doc: any; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const deleted = !!doc?.deleted_at;

  async function softDelete() {
    if (!confirm('Dokument in Papierkorb verschieben? (30 Tage wiederherstellbar)')) return;
    setBusy(true);
    const { error } = await supabase.from('alixdocs2_documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('In Papierkorb verschoben');
    onChange();
  }
  async function restore() {
    setBusy(true);
    const { error } = await supabase.from('alixdocs2_documents').update({ deleted_at: null }).eq('id', doc.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Wiederhergestellt');
    onChange();
  }

  return deleted ? (
    <Button size="sm" variant="outline" onClick={restore} disabled={busy}><RotateCcw className="w-4 h-4 mr-1" /> Wiederherstellen</Button>
  ) : (
    <Button size="sm" variant="ghost" className="text-destructive" onClick={softDelete} disabled={busy}><Trash2 className="w-4 h-4 mr-1" /> Löschen</Button>
  );
}
