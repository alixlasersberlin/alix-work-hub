import SalesWizard from '@/components/SalesWizard';

export default function NeueAnfrage() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Neue Anfrage</h1>
        <p className="text-sm text-muted-foreground">Alix AI Sales Wizard – Anfrage manuell erfassen</p>
      </div>
      <SalesWizard />
    </div>
  );
}
