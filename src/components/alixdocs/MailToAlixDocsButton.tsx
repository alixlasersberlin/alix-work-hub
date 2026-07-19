import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Files, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  attachmentId: string;
  orderId?: string | null;
  customerId?: string | null;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm';
}

/** Kleiner Button, der einen MailCenter-Anhang nach AlixDocs importiert. */
export default function MailToAlixDocsButton({ attachmentId, orderId, customerId, variant = 'ghost', size = 'sm' }: Props) {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<{ id: string; code: string; name: string }[]>([]);
  const [cat, setCat] = useState('sonstiges');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const openDialog = async () => {
    if (cats.length === 0) {
      const { data } = await supabase.from('alixdocs_categories').select('id, code, name').order('sort_order');
      setCats((data ?? []) as any);
    }
    setOpen(true);
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('alixdocs-mail-import', {
        body: { mail_attachment_id: attachmentId, category_code: cat, order_id: orderId, customer_id: customerId, title: title || undefined },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success('In AlixDocs abgelegt');
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Import fehlgeschlagen');
    } finally { setBusy(false); }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={openDialog} title="In AlixDocs ablegen">
        <Files className="w-4 h-4 mr-1" /> AlixDocs
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anhang in AlixDocs ablegen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Titel (optional)</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Kategorie</label>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cats.map(c => <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={doImport} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Ablegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
