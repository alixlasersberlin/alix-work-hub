import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSignature } from 'lucide-react';

type Sig = {
  id: string;
  contract_version: number | null;
  signed_by_name: string;
  signed_by_role: string | null;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  consents: any;
  signature_storage_path: string | null;
};

export function ContractSignatureDetailsDialog({
  open, onOpenChange, contractId, contractLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string | null;
  contractLabel?: string;
}) {
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !contractId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('customer_portal_contract_signatures' as any)
        .select('id, contract_version, signed_by_name, signed_by_role, signed_at, ip_address, user_agent, consents, signature_storage_path')
        .eq('contract_id', contractId)
        .order('signed_at', { ascending: false });
      setSigs((data ?? []) as any);
      setLoading(false);
    })();
  }, [open, contractId]);

  const downloadCert = async (path: string) => {
    const { data } = await supabase.storage.from('portal-uploads').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSignature className="w-4 h-4" /> Signaturhistorie</DialogTitle>
          <DialogDescription>{contractLabel ?? 'Vertrag'}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : sigs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Keine Signaturen vorhanden.</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {sigs.map((s) => (
              <div key={s.id} className="border border-border rounded-lg p-3 space-y-1.5 text-sm bg-secondary/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{s.signed_by_name}{s.signed_by_role ? ` · ${s.signed_by_role}` : ''}</div>
                  <Badge variant="outline">v{s.contract_version ?? 1}</Badge>
                </div>
                <Row label="Signiert am" value={new Date(s.signed_at).toLocaleString('de-DE')} />
                <Row label="IP-Adresse" value={s.ip_address ?? '—'} />
                <Row label="Signatur-ID" value={<span className="font-mono text-xs">{s.id}</span>} />
                {s.consents?.text && <Row label="Zustimmung" value={<span className="text-xs">{s.consents.text}</span>} />}
                {s.user_agent && <Row label="User-Agent" value={<span className="text-xs text-muted-foreground break-all">{s.user_agent}</span>} />}
                {s.signature_storage_path && (
                  <button
                    onClick={() => downloadCert(s.signature_storage_path!)}
                    className="text-xs text-primary hover:underline mt-1"
                  >
                    Signaturzertifikat öffnen →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
