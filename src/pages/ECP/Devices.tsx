import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { mockDevices } from '@/lib/ecp/mock';
import { Cpu } from 'lucide-react';

export default function EcpDevices() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {mockDevices.map((d) => (
        <Link to={`/ecp/geraete/${d.id}`} key={d.id}>
          <Card className="p-4 hover:border-primary/50">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center"><Cpu className="h-6 w-6 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{d.model}</div>
                <div className="text-xs text-muted-foreground truncate">SN: {d.serial}</div>
                <div className="text-xs text-muted-foreground">{d.location}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-emerald-500">{d.status}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Garantie bis</span><br />{d.warrantyUntil}</div>
              <div><span className="text-muted-foreground">Firmware</span><br />{d.firmware}</div>
              <div><span className="text-muted-foreground">Letzter Service</span><br />{d.lastService}</div>
              <div><span className="text-muted-foreground">Nächste Wartung</span><br />{d.nextService}</div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
