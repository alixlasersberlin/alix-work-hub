import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, CalendarCheck, CheckCircle2, Clock, Globe, MapPin, Users, ShieldCheck, PackageSearch, Cpu, ChevronDown, Mail, Sparkles, FileText, Banknote, BookOpen, Tag, KeyRound, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { useEmployees } from '@/hooks/esc/useEmployees';
import { DEFAULT_LOCATIONS, DEFAULT_BOOKING_SETTINGS, generateSlots, nextAvailableDays, customerBookingsToday } from '@/lib/esc/booking-settings';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { format } from 'date-fns';
import { confirmUrl } from '@/lib/esc/public-url';
import { supabase } from '@/integrations/supabase/client';
import type { EscDepartment } from '@/lib/esc/types';
import type { EscAppointmentKind } from '@/lib/esc/appointment-kinds';
import { useBookingT } from '@/i18n/booking';

type StepId = 'department' | 'service' | 'location' | 'time' | 'contact' | 'summary';
const STEPS: StepId[] = ['department', 'service', 'location', 'time', 'contact', 'summary'];


export default function BookingPortal() {
  const { department: deptParam, service: serviceParam } = useParams();
  const navigate = useNavigate();
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { appointments, createAppointment } = useAppointments();
  const { t } = useBookingT();
  const de = t.dateLocale;
  const STEP_LABEL = t.step;


  // Public departments: fetched directly from Supabase so anonymous visitors on /book
  // see the real, admin-managed list instead of local mock seed data.
  const [remoteDepts, setRemoteDepts] = useState<EscDepartment[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc('esc_public_departments');
      if (cancelled) return;
      if (error || !data) { setRemoteDepts([]); return; }
      setRemoteDepts((data as any[]).map((r) => r.data as EscDepartment));
    })();
    return () => { cancelled = true; };
  }, []);

  // Öffentlich buchbare Terminarten (RPC, für anonyme Besucher).
  const [remoteKinds, setRemoteKinds] = useState<EscAppointmentKind[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc('esc_public_appointment_kinds');
      if (cancelled) return;
      if (error || !data) { setRemoteKinds([]); return; }
      setRemoteKinds((data as any[]).map((r) => r.data as EscAppointmentKind));
    })();
    return () => { cancelled = true; };
  }, []);

  const sourceDepts = remoteDepts && remoteDepts.length ? remoteDepts : departments;
  const publicDepts = useMemo(
    () => sourceDepts
      .filter((d) => d.active && d.publicBookable && d.externallyBookable)
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name)),
    [sourceDepts],
  );


  const [step, setStep] = useState<StepId>('department');
  const [state, setState] = useState({
    departmentId: '',
    service: '',
    locationId: '',
    dayIso: '',
    slotIso: '',
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    message: '',
    contactPersonId: '',
    consentPrivacy: false,
    consentEmail: false,
    consentMarketing: false,
    turnstileOk: true, // stub: real CAPTCHA plugs in here
  });
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const showAngebotBubble = true;
  const [sent, setSent] = useState<{ bookingNumber: string; token: string } | null>(null);

  // Pre-fill from URL
  useEffect(() => {
    if (deptParam && publicDepts.some((d) => d.id === deptParam)) {
      setState((s) => ({ ...s, departmentId: deptParam, service: serviceParam || s.service }));
      setStep(serviceParam ? 'location' : 'service');
    }
  }, [deptParam, serviceParam, publicDepts]);

  const dept = publicDepts.find((d) => d.id === state.departmentId);
  const duration = dept?.defaultDurationMinutes || 60;
  const bookableEmployees = useMemo(
    () => employees.filter((e) => e.active && e.publicBookable && e.departmentIds.includes(state.departmentId)),
    [employees, state.departmentId],
  );

  const nextDays = useMemo(
    () => nextAvailableDays(new Date(), 14, DEFAULT_BOOKING_SETTINGS),
    [],
  );
  const slotsForDay = useMemo(() => {
    if (!state.dayIso) return [];
    return generateSlots(new Date(state.dayIso), duration, appointments, DEFAULT_BOOKING_SETTINGS);
  }, [state.dayIso, duration, appointments]);

  const stepIndex = STEPS.indexOf(step);
  const goto = (s: StepId) => setStep(s);
  const canGoNext = (() => {
    if (step === 'department') return !!state.departmentId;
    if (step === 'service') return !!state.service;
    if (step === 'location') return !!state.locationId;
    if (step === 'time') return !!state.slotIso;
    if (step === 'contact') return state.firstName.trim() && state.lastName.trim() && state.email.trim() && state.phone.trim() && state.company.trim() && state.consentPrivacy && state.consentEmail && state.turnstileOk;
    return true;
  })();

  const submit = async () => {
    if (!dept || !state.slotIso) return;
    if (customerBookingsToday(state.email, appointments, new Date(state.slotIso)) >= DEFAULT_BOOKING_SETTINGS.maxPerCustomerPerDay) {
      toast.error(t.errors.max_per_day);
      return;
    }
    const start = new Date(state.slotIso);
    const end = new Date(start.getTime() + duration * 60_000);
    const loc = DEFAULT_LOCATIONS.find((l) => l.id === state.locationId);
    const bookingNumber = `AW-${format(new Date(), 'yyMMdd')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const created = await createAppointment({
      title: `${dept.name} · ${state.service} · ${state.firstName} ${state.lastName}${state.company ? ' (' + state.company + ')' : ''}`,
      description: state.message,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      departmentId: dept.id,
      kind: state.service,
      employeeIds: state.contactPersonId ? [state.contactPersonId] : [],
      customerName: `${state.firstName} ${state.lastName}`.trim(),
      customerContact: state.firstName,
      customerEmail: state.email,
      customerPhone: state.phone,
      location: loc?.label || '',
      address: '',
      status: 'angefragt',
      priority: 'normal',
      externalNote: `Buchungsnummer: ${bookingNumber}${state.website ? '\nWebseite: ' + state.website : ''}${state.consentMarketing ? '\nMarketing-Einwilligung: ja' : ''}`,
      confirmationRequired: true,
    });
    setSent({ bookingNumber, token: (created as any)?.confirmationToken || bookingNumber });
    navigate('/book/confirmation', { replace: true });
  };

  if (sent) {
    return (
      <BookingLayout narrow hideLegalLinks>
        <Card className="border-primary/30">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-[18px]">{t.thanks.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3 text-[13.5px]">
            <p>{t.thanks.text}</p>
            <div className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-[12px]">
              <span className="text-muted-foreground">{t.thanks.number_label}</span>
              <span className="font-mono font-semibold">{sent.bookingNumber}</span>
            </div>
            <div className="pt-2">
              <a href={confirmUrl(sent.token)} className="text-primary hover:underline text-[12px] break-all">{confirmUrl(sent.token)}</a>
            </div>
            <Button variant="outline" onClick={() => { setSent(null); setStep('department'); setState({ ...state, departmentId: '', service: '', locationId: '', dayIso: '', slotIso: '' }); }}>{t.thanks.again}</Button>
          </CardContent>
        </Card>
      </BookingLayout>
    );
  }

  return (
    <BookingLayout step={stepIndex + 1} totalSteps={STEPS.length} hideLegalLinks>
      <div className="hidden md:flex items-center gap-2 text-[11.5px] text-muted-foreground">
        {STEPS.map((s, i) => (
          <div key={s} className={`flex items-center gap-1 ${i === stepIndex ? 'text-primary font-medium' : ''}`}>
            <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${i <= stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{i + 1}</span>
            <span>{STEP_LABEL[s]}</span>
            {i < STEPS.length - 1 && <span className="mx-1 text-muted-foreground/40">›</span>}
          </div>
        ))}
      </div>

      {step === 'department' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSalesOpen((v) => !v)}
            aria-expanded={salesOpen}
            className="w-full text-left rounded-xl border p-4 bg-card hover:border-primary hover:shadow-md transition-all flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px] flex items-center gap-2">
                <span>{t.cards.offer_title}</span>
                {showAngebotBubble && (
                  <span
                    style={{ transformOrigin: 'left center' }}
                    className="relative inline-flex items-center rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[11px] font-medium shadow-md animate-fade-in -translate-y-2 -rotate-6
                      before:content-[''] before:absolute before:-left-1.5 before:top-1/2 before:-translate-y-1/2 before:border-y-[5px] before:border-y-transparent before:border-r-[6px] before:border-r-primary"
                  >
                    {t.cards.offer_badge}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-muted-foreground mt-0.5">
                {t.cards.offer_desc}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground mt-1 shrink-0 transition-transform ${salesOpen ? 'rotate-180' : ''}`} />
          </button>
          {salesOpen && (
            <div className="rounded-xl border bg-card p-4">
              <div className="grid grid-cols-1 gap-3">
                {[
                  { label: t.cards.offer_create, icon: FileText },
                ].map((item) => (
                  <a
                    key={item.label}
                    href="/beratung"
                    className="text-left rounded-xl border p-4 transition-all hover:border-primary hover:shadow-md bg-card flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="font-semibold text-[13.5px]">{item.label}</div>
                  </a>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <a href="/beratung" className="inline-flex items-center gap-1 text-[12.5px] text-primary hover:underline">
                  {t.cards.offer_more} <ArrowRight className="w-3.5 h-3.5" />
                </a>

              </div>
            </div>
          )}
        </div>
      )}

      {step === 'department' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setDeptOpen((v) => !v)}
            aria-expanded={deptOpen}
            className="w-full text-left rounded-xl border p-4 bg-card hover:border-primary hover:shadow-md transition-all flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px]">{t.cards.inquiry_title}</div>
              <div className="text-[12px] text-muted-foreground mt-0.5">
                {t.cards.inquiry_desc}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground mt-1 shrink-0 transition-transform ${deptOpen ? 'rotate-180' : ''}`} />
          </button>
          {deptOpen && (
            <div className="rounded-xl border bg-card p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {publicDepts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { setState({ ...state, departmentId: d.id }); goto('service'); }}
                    className={`text-left rounded-xl border p-4 transition-all hover:border-primary hover:shadow-md min-h-24 ${state.departmentId === d.id ? 'border-primary bg-primary/5' : 'bg-card'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <div className="font-semibold text-[14px]">{d.name}</div>
                    </div>
                    <div className="text-[12px] text-muted-foreground mb-2 line-clamp-2">{d.description}</div>
                    <div className="text-[10.5px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {d.defaultDurationMinutes} min</div>
                  </button>
                ))}
              </div>
              {publicDepts.length === 0 && <div className="text-[13px] text-muted-foreground py-6 text-center">{t.cards.no_public}</div>}
            </div>
          )}
        </div>
      )}

      {step === 'department' && (
        <button
          onClick={() => navigate('/portal')}
          className="w-full text-left rounded-xl border p-4 bg-card hover:border-primary hover:shadow-md transition-all flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <PackageSearch className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[14px]">{t.cards.orderstatus_title}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {t.cards.orderstatus_desc}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
        </button>
      )}

      {step === 'department' && (
        <a
          href="/book/mediapaket"
          className="w-full text-left rounded-xl border p-4 bg-card hover:border-primary hover:shadow-md transition-all flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <PackageSearch className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[14px]">{t.cards.medipaket_title}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {t.cards.medipaket_desc}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
        </a>
      )}

      {step === 'department' && (
        <a
          href="https://alixsmart.de"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-left rounded-xl border p-4 bg-card hover:border-primary hover:shadow-md transition-all flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[14px] flex items-center gap-2">
              <span>Anmeldung und Registrierung nach NISV</span>
              {showAngebotBubble && (
                <span
                  style={{ transformOrigin: 'left center' }}
                  className="relative inline-flex items-center rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[11px] font-medium shadow-md animate-fade-in -translate-y-2 -rotate-6
                    before:content-[''] before:absolute before:-left-1.5 before:top-1/2 before:-translate-y-1/2 before:border-y-[5px] before:border-y-transparent before:border-r-[6px] before:border-r-primary"
                >
                  PFLICHT!
                </span>
              )}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              Die virtuelle Verwaltung Ihres Alix Gerätes: amtliche Dokumente, Tickets, Anleitungen und Ratgeber.
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
        </a>
      )}

      {step === 'department' && (
        <a
          href="https://eanamnese.de"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-left rounded-xl border p-4 bg-card hover:border-primary hover:shadow-md transition-all flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[14px]">Alix Smart - Anamnese Online - Termine alles auf Ihren Laser</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              Alle Daten aus Ihrem Laser, Anamnese Online, Reservierungen, Kundendaten, Termine und viele Tools mehr – Alix Interaktiv.
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
        </a>
      )}


      {step === 'service' && dept && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[16px]">Terminart wählen</CardTitle>
            <p className="text-[12.5px] text-muted-foreground">Für <b>{dept.name}</b>.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(() => {
              const kindsForDept = remoteKinds.filter((k) => k.departmentIds.length === 0 || k.departmentIds.includes(dept.id));
              const list = kindsForDept.length
                ? kindsForDept.map((k) => ({ name: k.name, description: k.description, color: k.color, duration: k.defaultDurationMinutes || duration }))
                : ['Beratung', 'Online Demo', 'Vorführung', 'Geräteeinweisung', 'Produktschulung'].map((n) => ({ name: n, description: undefined as string | undefined, color: undefined as string | undefined, duration }));
              return list.map((s) => (
                <button
                  key={s.name}
                  onClick={() => { setState({ ...state, service: s.name }); goto('location'); }}
                  className={`text-left rounded-xl border p-4 hover:border-primary hover:shadow-md transition ${state.service === s.name ? 'border-primary bg-primary/5' : 'bg-card'}`}
                >
                  <div className="flex items-center gap-2">
                    {s.color && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />}
                    <div className="font-semibold text-[14px]">{s.name}</div>
                  </div>
                  {s.description && <div className="text-[11.5px] text-muted-foreground mt-1 line-clamp-2">{s.description}</div>}
                  <div className="text-[11.5px] text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> ca. {s.duration} min</div>
                </button>
              ));
            })()}
          </CardContent>
        </Card>
      )}

      {step === 'location' && (
        <Card>
          <CardHeader><CardTitle className="text-[16px]">Standort auswählen</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DEFAULT_LOCATIONS.map((l) => (
              <button
                key={l.id}
                onClick={() => { setState({ ...state, locationId: l.id }); goto('time'); }}
                className={`text-left rounded-xl border p-4 hover:border-primary hover:shadow-md transition ${state.locationId === l.id ? 'border-primary bg-primary/5' : 'bg-card'}`}
              >
                <div className="flex items-center gap-2">
                  {l.online ? <Globe className="w-4 h-4 text-primary" /> : <MapPin className="w-4 h-4 text-primary" />}
                  <div className="font-semibold text-[14px]">{l.label}</div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 'time' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[16px]">Freien Termin wählen</CardTitle>
            <p className="text-[12.5px] text-muted-foreground">Nur tatsächlich verfügbare Zeiten werden angezeigt.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {nextDays.map((d) => {
                const active = state.dayIso === d.toISOString();
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setState({ ...state, dayIso: d.toISOString(), slotIso: '' })}
                    className={`min-w-[76px] rounded-lg border p-2 text-center transition ${active ? 'border-primary bg-primary/10' : 'hover:border-primary'}`}
                  >
                    <div className="text-[10.5px] uppercase text-muted-foreground">{format(d, 'EE', { locale: de })}</div>
                    <div className="text-[16px] font-semibold">{format(d, 'dd')}</div>
                    <div className="text-[10.5px] text-muted-foreground">{format(d, 'MMM', { locale: de })}</div>
                  </button>
                );
              })}
            </div>

            {state.dayIso && (
              <>
                {slotsForDay.length === 0 ? (
                  <div className="rounded-md border p-4 text-center bg-muted/30">
                    <div className="text-[13px] mb-2">Für den gewählten Tag sind keine Zeiten verfügbar.</div>
                    <Button variant="outline" size="sm" onClick={() => setWaitlistOpen(true)}><Users className="w-4 h-4 mr-1" />Auf Warteliste setzen</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {slotsForDay.map((s) => {
                      const active = state.slotIso === s.toISOString();
                      return (
                        <button
                          key={s.toISOString()}
                          onClick={() => { setState({ ...state, slotIso: s.toISOString() }); goto('contact'); }}
                          className={`rounded-md border py-2 text-[13px] font-medium min-h-11 hover:border-primary transition ${active ? 'border-primary bg-primary/10' : ''}`}
                        >
                          {format(s, 'HH:mm')}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {waitlistOpen && (
              <div className="rounded-md border p-3 bg-muted/20 text-[12.5px]">
                <div className="font-medium mb-1">Warteliste</div>
                <p className="text-muted-foreground mb-2">Wir informieren Sie per E-Mail, sobald ein passender Termin frei wird.</p>
                <div className="flex gap-2">
                  <Input placeholder="Ihre E-Mail" value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} className="h-9" />
                  <Button size="sm" onClick={() => { toast.success('Auf Warteliste gesetzt.'); setWaitlistOpen(false); }}>Eintragen</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'contact' && (
        <Card>
          <CardHeader><CardTitle className="text-[16px]">Ihre Kontaktdaten</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Vorname *</Label><Input value={state.firstName} onChange={(e) => setState({ ...state, firstName: e.target.value })} /></div>
              <div><Label>Nachname *</Label><Input value={state.lastName} onChange={(e) => setState({ ...state, lastName: e.target.value })} /></div>
              <div><Label>Firma *</Label><Input value={state.company} onChange={(e) => setState({ ...state, company: e.target.value })} /></div>
              <div><Label>Webseite</Label><Input value={state.website} onChange={(e) => setState({ ...state, website: e.target.value })} placeholder="https://" /></div>
              <div><Label>E-Mail *</Label><Input type="email" value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} /></div>
              <div><Label>Telefon *</Label><Input value={state.phone} onChange={(e) => setState({ ...state, phone: e.target.value })} /></div>
              {bookableEmployees.length > 0 && (
                <div className="md:col-span-2">
                  <Label>Gewünschter Ansprechpartner (optional)</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <button type="button" onClick={() => setState({ ...state, contactPersonId: '' })} className={`text-[12px] rounded-full border px-3 py-1 ${!state.contactPersonId ? 'border-primary bg-primary/10' : ''}`}>Egal</button>
                    {bookableEmployees.map((e) => (
                      <button key={e.id} type="button" onClick={() => setState({ ...state, contactPersonId: e.id })} className={`text-[12px] rounded-full border px-3 py-1 ${state.contactPersonId === e.id ? 'border-primary bg-primary/10' : ''}`}>{e.name}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="md:col-span-2">
                <Label>Nachricht</Label>
                <Textarea rows={3} value={state.message} onChange={(e) => setState({ ...state, message: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <label className="flex items-start gap-2 text-[12.5px]">
                <Checkbox checked={state.consentPrivacy} onCheckedChange={(v) => setState({ ...state, consentPrivacy: !!v })} className="mt-0.5" />
                <span>Ich habe die <a href="https://alixworks.de/datenschutz" target="_blank" rel="noreferrer" className="text-primary hover:underline">Datenschutzerklärung</a> gelesen und akzeptiere sie. *</span>
              </label>
              <label className="flex items-start gap-2 text-[12.5px]">
                <Checkbox checked={state.consentEmail} onCheckedChange={(v) => setState({ ...state, consentEmail: !!v })} className="mt-0.5" />
                <span>Ich willige in den Empfang von E-Mails zu diesem Termin ein. *</span>
              </label>
              <label className="flex items-start gap-2 text-[12.5px]">
                <Checkbox checked={state.consentMarketing} onCheckedChange={(v) => setState({ ...state, consentMarketing: !!v })} className="mt-0.5" />
                <span>Optional: Ich möchte weitere Angebote per E-Mail erhalten.</span>
              </label>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Geschützt vor Spam · CAPTCHA (Cloudflare Turnstile) wird aktiviert.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'summary' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[16px]">Zusammenfassung</CardTitle>
            <p className="text-[12.5px] text-muted-foreground">Bitte prüfen Sie Ihre Angaben.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px]">
            <SumRow label="Leistung" value={dept?.name} />
            <SumRow label="Terminart" value={state.service} />
            <SumRow label="Standort" value={DEFAULT_LOCATIONS.find((l) => l.id === state.locationId)?.label} />
            <SumRow label="Datum" value={state.slotIso ? format(new Date(state.slotIso), 'EEEE, dd. MMMM yyyy', { locale: de }) : ''} />
            <SumRow label="Uhrzeit" value={state.slotIso ? `${format(new Date(state.slotIso), 'HH:mm')} · ca. ${duration} min` : ''} />
            {state.contactPersonId && <SumRow label="Ansprechpartner" value={bookableEmployees.find((e) => e.id === state.contactPersonId)?.name} />}
            <div className="border-t pt-2 space-y-1">
              <SumRow label="Kontakt" value={`${state.firstName} ${state.lastName}`} />
              <SumRow label="Firma" value={state.company} />
              <SumRow label="E-Mail" value={state.email} />
              <SumRow label="Telefon" value={state.phone} />
            </div>
            {state.message && <div className="text-[12px] text-muted-foreground italic">„{state.message}"</div>}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => (stepIndex > 0 ? goto(STEPS[stepIndex - 1]) : null)} disabled={stepIndex === 0}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
        </Button>
        {step === 'summary' ? (
          <Button size="lg" onClick={submit} disabled={!canGoNext}>
            <CalendarCheck className="w-4 h-4 mr-1" /> Buchung absenden
          </Button>
        ) : (
          <Button onClick={() => goto(STEPS[stepIndex + 1])} disabled={!canGoNext}>
            Weiter <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      <div className="text-center pt-2">
        <Badge variant="outline" className="text-[10.5px]">alixworks.de · Sichere Verbindung</Badge>
      </div>
    </BookingLayout>
  );
}

function SumRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}
