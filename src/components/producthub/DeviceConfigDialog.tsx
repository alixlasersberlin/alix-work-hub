import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PH_DEFAULT_COLORS, PH_DEFAULT_POWERS, deviceConfigComplete, isRalColor, type DeviceConfig,
} from '@/lib/producthub/deviceConfig';

export type DeviceConfigTarget = {
  productId?: string | null;
  productName: string;
  colors?: string[] | null;
  powers?: string[] | null;
  imageUrl?: string | null;
  initial?: DeviceConfig | null;
};


export function DeviceConfigDialog({
  open, target, onOpenChange, onConfirm,
}: {
  open: boolean;
  target: DeviceConfigTarget | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (cfg: DeviceConfig) => void;
}) {
  const colors = (target?.colors?.length ? target.colors : [...PH_DEFAULT_COLORS]) as string[];
  const powers = (target?.powers?.length ? target.powers : [...PH_DEFAULT_POWERS]) as string[];

  const [color, setColor] = useState('');
  const [ral, setRal] = useState('');
  const [power, setPower] = useState('');

  useEffect(() => {
    if (!open) return;
    setColor(target?.initial?.device_color || '');
    setRal(target?.initial?.ral_color_code || '');
    setPower(target?.initial?.laser_module_power || '');
  }, [open, target]);

  const cfg: DeviceConfig = {
    product_id: target?.productId ?? null,
    product_name: target?.productName ?? null,
    device_color: color || null,
    ral_color_code: isRalColor(color) ? (ral.trim() || null) : null,
    laser_module_power: power || null,
  };
  const valid = deviceConfigComplete(cfg);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerät konfigurieren</DialogTitle>
          <DialogDescription>{target?.productName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Farbe des Gerätes *</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
              <SelectContent className="z-[100]">
                {colors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isRalColor(color) && (
            <div className="space-y-1.5">
              <Label className="text-xs">RAL-Farbnummer *</Label>
              <Input
                value={ral}
                onChange={e => setRal(e.target.value)}
                placeholder="z. B. RAL 5002"
                className="bg-secondary border-border"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Leistung Lasermodul *</Label>
            <Select value={power} onValueChange={setPower}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
              <SelectContent className="z-[100]">
                {powers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button disabled={!valid} onClick={() => { onConfirm(cfg); onOpenChange(false); }}>Gerät übernehmen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeviceConfigDialog;
