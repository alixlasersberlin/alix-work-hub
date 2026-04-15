import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  customer: any;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export default function CustomerDeleteDialog({ customer, open, onClose, onDeleted }: Props) {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);

    // 1. Record in deleted_customers to prevent re-import
    if (customer.external_customer_id && customer.source_system) {
      await supabase.from('deleted_customers').insert({
        external_customer_id: customer.external_customer_id,
        source_system: customer.source_system,
        company_name: customer.company_name || customer.contact_name || null,
        deleted_by: user?.id,
      });
    }

    // 2. Delete the customer
    const { error } = await supabase.from('customers').delete().eq('id', customer.id);
    setDeleting(false);

    if (error) {
      toast.error('Fehler beim Löschen: ' + error.message);
      return;
    }

    toast.success('Kunde gelöscht – Re-Import gesperrt');
    onDeleted();
    onClose();
  }

  return (
    <AlertDialog open={open} onOpenChange={v => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Kunde löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{customer.company_name || customer.contact_name || 'Dieser Kunde'}</strong> wird
            unwiderruflich gelöscht und kann nicht erneut importiert werden.
            Alle zugehörigen Aufträge bleiben bestehen, aber der Kundenbezug geht verloren.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Endgültig löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
