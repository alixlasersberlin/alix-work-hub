import { useLocation } from "react-router-dom";
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted mb-6">
          <Shield className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-5xl font-display font-bold gold-text mb-3">404</h1>
        <p className="text-lg text-foreground font-medium mb-2">Seite nicht gefunden</p>
        <p className="text-muted-foreground text-sm mb-8">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <Button asChild className="gold-gradient font-semibold">
          <a href="/">Zum Dashboard</a>
        </Button>
      </div>
    </div>
  );
}
