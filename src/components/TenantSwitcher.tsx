import { useTenant } from '@/contexts/TenantContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';

export default function TenantSwitcher() {
  const { allowedTenants, current, setCurrent, loading } = useTenant();
  if (loading || allowedTenants.length <= 1) return null;

  const value = current?.code ?? '__all__';
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === '__all__') setCurrent(null);
        else setCurrent(allowedTenants.find(t => t.code === v) || null);
      }}
    >
      <SelectTrigger
        className="h-9 w-[64px] bg-secondary border-border justify-center px-2"
        aria-label="Mandant wählen"
        title={current?.name ?? 'Alix World'}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">
          <span className="inline-flex items-center justify-center text-lg" title="Alle Mandanten">
            <Globe className="w-4 h-4" />
          </span>
        </SelectItem>
        {allowedTenants.map(t => (
          <SelectItem key={t.code} value={t.code}>
            <span className="inline-flex items-center justify-center text-lg" title={t.name} aria-label={t.name}>
              {t.flag_emoji || '🏢'}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
