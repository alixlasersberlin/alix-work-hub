import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarPlus, Copy } from "lucide-react";
import { toast } from "sonner";
import { RmModal } from "@/components/esc/resources/RmModal";
import { AppointmentModalTabs } from "@/components/esc/AppointmentModalTabs";
import { useDepartments } from "@/hooks/esc/useDepartments";
import { useEmployees } from "@/hooks/esc/useEmployees";
import { useResources } from "@/hooks/esc/useResources";
import type { EscAppointment, EscPriority } from "@/lib/esc/types";

type TicketLike = {
  id: string;
  ticket_number?: string | null;
  external_ticket_id?: string | null;
  title?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  priority?: string | null;
  department?: string | null;
  assigned_to?: string | null;
};

const PRIO_MAP: Record<string, EscPriority> = {
  low: "low", niedrig: "low",
  normal: "normal", mittel: "normal", medium: "normal",
  high: "high", hoch: "high",
  urgent: "urgent", kritisch: "urgent", critical: "urgent", dringend: "urgent",
};

export function CreateAppointmentFromTicket({
  ticketId,
  ticketNumber,
  ticket,
}: {
  ticketId: string;
  ticketNumber?: string | null;
  ticket?: TicketLike;
}) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<{ confirm: string; reschedule: string; cancel: string } | null>(null);
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { resources } = useResources();

  const label = ticketNumber ?? ticket?.ticket_number ?? ticket?.external_ticket_id ?? "Ticket";

  const initial: Partial<EscAppointment> = {
    title: ticket?.title ? `${label} · ${ticket.title}` : `${label}`,
    kind: "kundentermin",
    customerName: ticket?.customer_name ?? undefined,
    customerEmail: ticket?.customer_email ?? undefined,
    customerPhone: ticket?.customer_phone ?? undefined,
    address: ticket?.customer_address ?? undefined,
    priority: (ticket?.priority && PRIO_MAP[ticket.priority.toLowerCase()]) || "normal",
    employeeIds: ticket?.assigned_to ? [ticket.assigned_to] : [],
    confirmationRequired: true,
  };

  const handleSubmit = async (payload: Omit<EscAppointment, "id" | "createdAt" | "updatedAt">) => {
    const { data, error } = await supabase.functions.invoke("ticket-create-appointment", {
      body: {
        ticket_id: ticketId,
        start_at: payload.startAt,
        end_at: payload.endAt,
        event_kind: payload.kind || "kundentermin",
        title: payload.title,
        description: payload.description,
        department_id: payload.departmentId || undefined,
        assigned_user_id: payload.employeeIds?.[0],
        resource_id: payload.resourceId,
        customer_name: payload.customerName,
        customer_email: payload.customerEmail,
        customer_phone: payload.customerPhone,
        address: payload.address,
        location: payload.location,
        internal_note: payload.internalNote,
        external_note: payload.externalNote,
        priority: payload.priority,
        requires_confirmation: !!payload.confirmationRequired,
      },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Termin konnte nicht erstellt werden");
      throw new Error((data as any)?.error ?? error?.message ?? "create failed");
    }
    setLinks((data as any).links);
    toast.success("Termin erstellt und mit Ticket verknüpft.");
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Link kopiert"); };
  const close = () => { setOpen(false); };
  const closeLinks = () => { setLinks(null); };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setLinks(null); setOpen(true); }}>
        <CalendarPlus className="w-4 h-4 mr-2" /> Termin aus Ticket
      </Button>

      <AppointmentModalTabs
        open={open && !links}
        onClose={close}
        onSubmit={handleSubmit}
        departments={departments}
        employees={employees}
        resources={resources}
        initial={initial}
        canSeeInternal
      />

      <RmModal open={!!links} onClose={closeLinks} title={`Bestätigungslinks für ${label}`}>
        {links && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Termin ist im Kalender sichtbar und mit dem Ticket verknüpft. Diese Links kannst du dem Kunden zusenden:
            </p>
            {(["confirm", "reschedule", "cancel"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <Input readOnly value={links[k]} className="text-xs" />
                <Button size="icon" variant="ghost" onClick={() => copy(links[k])}><Copy className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button className="w-full" onClick={() => { setLinks(null); setOpen(false); }}>Fertig</Button>
          </div>
        )}
      </RmModal>
    </>
  );
}
