import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { DepartmentBadge } from '@/components/esc/DepartmentBadge';
import { toast } from 'sonner';
import alixLogo from '@/assets/alix-logo-gold.png';

export default function BookingPortal() {
  const { departments } = useDepartments();
  const { createAppointment } = useAppointments();
  const publicDepts = departments.filter((d) => d.active && d.publicBookable && d.externallyBookable);

  const [selectedDept, setSelectedDept] = useState<string>('');
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', location: '', desiredDate: '', desiredTime: '', message: '' });
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!selectedDept) { toast.error('Bitte Leistung wählen'); return; }
    if (!form.name || !form.email || !form.desiredDate) { toast.error('Name, E-Mail und Wunschdatum sind Pflicht'); return; }
    const dept = publicDepts.find((d) => d.id === selectedDept)!;
    const start = new Date(`${form.desiredDate}T${form.desiredTime || '09:00'}:00`);
    const end = new Date(start.getTime() + (dept.defaultDurationMinutes || 60) * 60_000);
    await createAppointment({
      title: `${dept.name}: ${form.name}${form.company ? ' (' + form.company + ')' : ''}`,
      description: form.message,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      departmentId: dept.id,
      employeeIds: [],
      customerName: form.name,
      customerEmail: form.email,
      customerPhone: form.phone,
      location: form.location,
      status: 'angefragt',
      priority: 'normal',
      confirmationRequired: true,
    });
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3">
          <img src={alixLogo} alt="AlixWorks" className="h-8" />
          <div>
            <div className="text-[14px] font-semibold">AlixWorks Buchungsportal</div>
            <div className="text-[11px] text-muted-foreground">alixworks.de</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        {sent ? (
          <Card>
            <CardHeader><CardTitle>Vielen Dank!</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <div>Ihre Anfrage wurde übermittelt. Sie erhalten in Kürze eine Bestätigungs-E-Mail.</div>
              <Button variant="outline" onClick={() => { setSent(false); setForm({ name: '', company: '', email: '', phone: '', location: '', desiredDate: '', desiredTime: '', message: '' }); setSelectedDept(''); }}>Weitere Anfrage</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="text-[15px]">Leistung wählen</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {publicDepts.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDept(d.id)}
                      className={`text-left rounded-lg border p-3 transition-colors hover:border-primary ${selectedDept === d.id ? 'border-primary bg-primary/5' : 'bg-card'}`}
                    >
                      <div className="mb-1"><DepartmentBadge dept={d} size="md" /></div>
                      <div className="text-[12px] text-muted-foreground">{d.description}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">Standarddauer: {d.defaultDurationMinutes} min</div>
                    </button>
                  ))}
                  {publicDepts.length === 0 && <div className="text-[13px] text-muted-foreground">Aktuell sind keine Leistungen öffentlich buchbar.</div>}
                </div>
              </CardContent>
            </Card>

            {selectedDept && (
              <Card>
                <CardHeader><CardTitle className="text-[15px]">Ihre Daten & Wunschtermin</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                    <div><Label>Firma / Praxis</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                    <div><Label>E-Mail *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><Label>Standort</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Datum *</Label><Input type="date" value={form.desiredDate} onChange={(e) => setForm({ ...form, desiredDate: e.target.value })} /></div>
                      <div><Label>Uhrzeit</Label><Input type="time" value={form.desiredTime} onChange={(e) => setForm({ ...form, desiredTime: e.target.value })} /></div>
                    </div>
                    <div className="md:col-span-2"><Label>Nachricht</Label><Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button onClick={submit}>Anfrage absenden</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <footer className="border-t mt-8 py-4 text-center text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} AlixWorks · alixworks.de
      </footer>
    </div>
  );
}
