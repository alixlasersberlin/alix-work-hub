import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-destructive/10 mb-6">
          <ShieldX className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">Kein Zugriff</h1>
        <p className="text-muted-foreground mb-8">
          Sie haben nicht die erforderlichen Berechtigungen, um auf diesen Bereich zuzugreifen.
          Bitte wenden Sie sich an Ihren Administrator.
        </p>
        <Button
          onClick={() => navigate('/')}
          className="gold-gradient font-semibold"
        >
          Zum Dashboard
        </Button>
      </div>
    </div>
  );
}
