import { useTenant } from '@/contexts/TenantContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Loader2 } from 'lucide-react';

export default function TenantSwitcher() {
  const { allowedTenants, current, setCurrent, loading } = useTenant();

  if (loading) {
    return (
      <div className="h-9 w-9 md:w-[190px] rounded-md border border-border bg-secondary flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (allowedTenants.length === 0) return null;

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
        aria-label="Mandant wählen"
        className="h-9 w-[120px] sm:w-[190px] bg-secondary border-border"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[60] bg-popover">
        <SelectItem value="__all__">
          <span className="inline-flex items-center gap-2"><Globe className="w-4 h-4" /> Alix World</span>
        </SelectItem>
        {allowedTenants.map(t => (
          <SelectItem key={t.code} value={t.code}>
            <span className="inline-flex items-center gap-2">
              {t.logo_url ? (
                <img src={t.logo_url} alt="" className="w-4 h-4 rounded-sm object-contain" />
              ) : (
                <span aria-hidden>{t.flag_emoji || '🏢'}</span>
              )}
              <span className="truncate">{t.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
