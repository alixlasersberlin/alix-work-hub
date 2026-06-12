import SalesWizard from '@/components/SalesWizard';
import bgAsset from '@/assets/wizard/alix-lasers-bg.jpg.asset.json';

export default function NeueAnfrage() {
  return (
    <div
      className="min-h-screen p-6 bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: `url(${bgAsset.url})` }}
    >
      <div className="mb-4 rounded-lg bg-background/70 backdrop-blur-sm p-4 inline-block">
        <h1 className="text-2xl font-semibold">Neue Anfrage</h1>
        <p className="text-sm text-muted-foreground">Alix Lasers® AI Sales Wizard – Anfrage manuell erfassen</p>
      </div>
      <SalesWizard />
    </div>
  );
}
