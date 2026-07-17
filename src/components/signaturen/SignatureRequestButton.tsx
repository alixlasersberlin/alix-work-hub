import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PenLine } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';


interface Props {
  entityType: 'order' | 'invoice' | 'offer' | 'service_report' | 'maintenance' | 'contract' | 'delivery' | string;
  entityId: string;
  documentType?: string;
  title?: string;
  customerId?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  label?: string;
}

// Öffnet die Signaturanfrage-Seite und übergibt Kontext via sessionStorage,
// damit Titel, Kunde und Referenz vorbelegt werden.
export function SignatureRequestButton({
  entityType, entityId, documentType, title, customerId,
  variant = 'outline', size = 'sm', label = 'Signatur anfordern',
}: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const onClick = () => {
    setBusy(true);
    sessionStorage.setItem('sig_handoff_v1', JSON.stringify({
      entity_type: entityType, entity_id: entityId,
      document_type: documentType || entityType, title, customer_id: customerId,
    }));
    navigate('/signaturen/neu');
  };
  return (
    <Button variant={variant} size={size} onClick={onClick} disabled={busy}>
      <PenLine className="w-3.5 h-3.5 mr-1.5" />{label}
    </Button>
  );
}

export default SignatureRequestButton;
