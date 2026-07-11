import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Users, Truck, DoorOpen, Cpu, Pencil } from 'lucide-react';

/**
 * Schnellzugriff auf Neuanlage und Änderung aller Ressourcen-Typen.
 * Wird auf allen Ressourcen- & Dispositions-Seiten eingeblendet.
 */
export function RmQuickActions() {
  const items = [
    { to: '/esc/rm/mitarbeiter',  label: 'Mitarbeiter', icon: Users },
    { to: '/esc/rm/fahrzeuge',    label: 'Fahrzeug',    icon: Truck },
    { to: '/esc/rm/raeume',       label: 'Raum',        icon: DoorOpen },
    { to: '/esc/rm/geraete',      label: 'Gerät',       icon: Cpu },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <span className="text-[11px] font-medium text-muted-foreground mr-1 flex items-center gap-1">
        <Pencil className="h-3 w-3" />Änderung &amp; Neuanlage:
      </span>
      {items.map((i) => (
        <Button key={i.to} asChild size="sm" variant="outline" className="h-7 text-[11px]">
          <Link to={i.to}><Plus className="h-3 w-3 mr-1" /><i.icon className="h-3 w-3 mr-1" />{i.label}</Link>
        </Button>
      ))}
    </div>
  );
}
