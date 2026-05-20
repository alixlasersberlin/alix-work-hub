import BankDecisionList from '@/components/BankDecisionList';
import { XCircle } from 'lucide-react';

export default function AbsagenBank() {
  return (
    <BankDecisionList
      status="rejected"
      title="Absagen Bank"
      subtitle="Übersicht der abgelehnten Leasing-Anfragen."
      icon={XCircle}
      emptyText="Keine Absagen vorhanden."
    />
  );
}
