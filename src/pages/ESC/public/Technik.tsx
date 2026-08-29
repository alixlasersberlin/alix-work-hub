import { Wrench } from 'lucide-react';

export default function Technik() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <section className="max-w-lg w-full text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
          <Wrench className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Technik</h1>
        <p className="text-sm text-muted-foreground">
          Dieser Bereich wird derzeit vorbereitet. Inhalte folgen in Kürze.
        </p>
      </section>
    </main>
  );
}
