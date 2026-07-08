import { useEmpPersona } from '@/hooks/emp/useEmpPersona';
import HomeWidgets from '@/components/emp/HomeWidgets';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export default function EmpHome() {
  const { persona, label } = useEmpPersona();
  const { profile } = useAuth();
  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
        <div className="text-xs text-muted-foreground">Willkommen</div>
        <div className="text-lg font-semibold">{(profile as any)?.first_name || (profile as any)?.full_name || 'Mitarbeiter'}</div>
        <div className="text-xs text-muted-foreground mt-1">Rolle: {label}</div>
      </Card>

      <div>
        <div className="text-sm font-medium mb-2">Übersicht</div>
        <HomeWidgets persona={persona} />
      </div>
    </div>
  );
}
