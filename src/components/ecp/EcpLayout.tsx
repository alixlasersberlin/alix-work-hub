import { Outlet } from 'react-router-dom';
import { useEcpRole } from '@/hooks/ecp/useEcpRole';
import { ROLE_LABELS, EcpRole } from '@/lib/ecp/roles';
import EcpSidebar from './EcpSidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

export default function EcpLayout() {
  const { role, setRole } = useEcpRole();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-3 flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menü">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">AlixWorks</div>
                <div className="text-sm font-semibold">Enterprise Customer Portal</div>
              </div>
              <EcpSidebar />
            </SheetContent>
          </Sheet>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">AlixWorks</div>
            <div className="text-sm md:text-base font-semibold leading-tight">Enterprise Customer Portal</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-muted-foreground">Rolle</span>
            <Select value={role} onValueChange={(v) => setRole(v as EcpRole)}>
              <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6 grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="hidden md:block"><EcpSidebar /></aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}
