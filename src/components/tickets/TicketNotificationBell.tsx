import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, AtSign, ArrowRightLeft, MessageSquare, UserPlus, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type Notif = {
  id: string;
  ticket_id: string | null;
  kind: string;
  title: string | null;
  message: string | null;
  actor_name: string | null;
  is_read: boolean;
  created_at: string;
};

const ICONS: Record<string, any> = {
  mention: AtSign,
  handover: ArrowRightLeft,
  participant_added: UserPlus,
  new_message: MessageSquare,
};

export function TicketNotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const unread = items.filter(i => !i.is_read).length;

  const load = async () => {
    if (!user?.id) return;
    const { data } = await (supabase.from("ticket_notifications") as any)
      .select("id, ticket_id, kind, title, message, actor_name, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => {
    if (!user?.id) return;
    load();
    const channel = supabase
      .channel(`ticket-notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markAllRead = async () => {
    if (!user?.id || unread === 0) return;
    await (supabase.from("ticket_notifications") as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false);
    load();
  };

  const markOneRead = async (id: string) => {
    await (supabase.from("ticket_notifications") as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
    setItems(prev => prev.map(i => (i.id === id ? { ...i, is_read: true } : i)));
  };

  if (!user?.id) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Benachrichtigungen">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="text-sm font-semibold">Ticket-Benachrichtigungen</div>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unread === 0}>
            <CheckCheck className="w-4 h-4 mr-1" /> Alle gelesen
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Keine Benachrichtigungen.</div>
          ) : (
            items.map(n => {
              const Icon = ICONS[n.kind] ?? Bell;
              return (
                <Link
                  key={n.id}
                  to={n.ticket_id ? `/tickets/${n.ticket_id}` : "/tickets"}
                  onClick={() => { markOneRead(n.id); setOpen(false); }}
                  className={`flex items-start gap-3 px-3 py-2.5 hover:bg-muted/50 ${!n.is_read ? "bg-primary/5" : ""}`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 ${!n.is_read ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.title || n.kind}</div>
                    {n.message && <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>}
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {n.actor_name ? `${n.actor_name} · ` : ""}
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: de })}
                    </div>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary mt-2" />}
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
