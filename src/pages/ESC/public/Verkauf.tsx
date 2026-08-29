import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Verkauf() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 sm:p-8">
      <section className="w-full max-w-xl">
        <div className="rounded-3xl border border-primary/40 bg-card/60 backdrop-blur shadow-[0_0_40px_-12px_hsl(var(--primary)/0.6)] p-6 sm:p-10 text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Verkauf</h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            WhatsApp · Angebote · Termine · Kataloge
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link to="/book">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
