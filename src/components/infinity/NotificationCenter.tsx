import { useState } from "react";
import { Bell, Check, X, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications, type InfinityNotification } from "@/hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const kindStyles: Record<NonNullable<InfinityNotification["kind"]>, string> = {
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  error: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const formatTime = (ts: number) => {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return "gerade eben";
  if (d < 3600) return `vor ${Math.floor(d / 60)} Min`;
  if (d < 86400) return `vor ${Math.floor(d / 3600)} Std`;
  return new Date(ts).toLocaleDateString("de-DE");
};

export const NotificationCenter = () => {
  const { list, unread, markRead, markAllRead, remove, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const onClick = (n: InfinityNotification) => {
    markRead(n.id);
    if (n.href) {
      setOpen(false);
      navigate(n.href);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl border border-amber-500/20 bg-background/40 backdrop-blur hover:bg-amber-500/10"
          aria-label={`Benachrichtigungen (${unread} ungelesen)`}
        >
          <Bell className="h-4 w-4 text-amber-300" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-bold text-black grid place-items-center shadow-lg shadow-amber-500/40">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[380px] p-0 border-amber-500/20 bg-background/95 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/10">
          <div>
            <h3 className="text-sm font-semibold">Benachrichtigungen</h3>
            <p className="text-[11px] text-muted-foreground">
              {unread} ungelesen · {list.length} gesamt
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={markAllRead}
              disabled={unread === 0}
              title="Alle als gelesen markieren"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-rose-300 hover:text-rose-200"
              onClick={clear}
              disabled={list.length === 0}
              title="Alle löschen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[440px]">
          {list.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Keine Benachrichtigungen
            </div>
          ) : (
            <ul className="divide-y divide-amber-500/5">
              {list.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "group relative px-4 py-3 hover:bg-amber-500/5 transition-colors cursor-pointer",
                    !n.read && "bg-amber-500/[0.03]"
                  )}
                  onClick={() => onClick(n)}
                >
                  <div className="flex items-start gap-3">
                    {!n.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{n.title}</span>
                        {n.kind && (
                          <span
                            className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider",
                              kindStyles[n.kind]
                            )}
                          >
                            {n.kind}
                          </span>
                        )}
                      </div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(n.createdAt)}
                        </span>
                        {n.module && (
                          <span className="text-[10px] text-amber-400/70">· {n.module}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead(n.id);
                          }}
                          className="h-5 w-5 grid place-items-center rounded hover:bg-amber-500/20"
                          title="Als gelesen"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(n.id);
                        }}
                        className="h-5 w-5 grid place-items-center rounded hover:bg-rose-500/20"
                        title="Entfernen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
