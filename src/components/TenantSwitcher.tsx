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
      <SelectTrigger className="h-9 w-[180px] bg-secondary border-border">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">
          <span className="inline-flex items-center gap-2"><Globe className="w-4 h-4" /> Alle Mandanten</span>
        </SelectItem>
        {allowedTenants.map(t => (
          <SelectItem key={t.code} value={t.code}>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden>{t.flag_emoji || '🏢'}</span>
              <span>{t.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
