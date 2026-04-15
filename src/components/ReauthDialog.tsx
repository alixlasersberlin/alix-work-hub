import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShieldCheck } from 'lucide-react';

interface ReauthDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reason?: string;
}

export default function ReauthDialog({ open, onClose, onSuccess }: ReauthDialogProps) {
  const handleContinue = () => {
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-foreground">Bestätigung</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Die zusätzliche Zwei-Faktor-Abfrage ist deaktiviert.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            Sie können diese Aktion direkt fortsetzen.
          </p>
          <Button onClick={handleContinue} className="w-full gold-gradient font-semibold">
            Fortfahren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
