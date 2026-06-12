import SalesWizard from '@/components/SalesWizard';

export default function NeueAnfrage() {
  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Neue Anfrage</h1>
        <p className="text-sm text-muted-foreground">Alix Lasers® AI Sales Wizard – Anfrage manuell erfassen</p>
      </div>
      <SalesWizard />
    </div>
  );
}
