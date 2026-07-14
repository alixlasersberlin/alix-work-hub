import { useCallback, useState } from 'react';

/**
 * Zero-Trust Re-Auth-Gate.
 *
 * Nutzung:
 *   const { gate, dialogProps } = useReauthGate('device.block');
 *   const onBlock = () => gate(() => actuallyBlock());
 *   ...
 *   <ReauthDialog {...dialogProps} />
 *
 * Cache: 5 Minuten pro purpose in sessionStorage. Ist der Cache noch
 * gültig, wird die Aktion direkt ausgeführt (kein Modal).
 */
export function useReauthGate(purpose: string, reason?: string) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<null | (() => void | Promise<void>)>(null);

  const isCachedValid = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(`alixwork.reauth.${purpose}`);
      if (!raw) return false;
      const until = Number(raw);
      if (!Number.isFinite(until)) return false;
      if (Date.now() < until) return true;
      sessionStorage.removeItem(`alixwork.reauth.${purpose}`);
      return false;
    } catch { return false; }
  }, [purpose]);

  const gate = useCallback((action: () => void | Promise<void>) => {
    if (isCachedValid()) {
      void action();
      return;
    }
    setPending(() => action);
    setOpen(true);
  }, [isCachedValid]);

  const dialogProps = {
    open,
    purpose,
    reason,
    onClose: () => { setOpen(false); setPending(null); },
    onSuccess: () => {
      const a = pending;
      setPending(null);
      setOpen(false);
      if (a) void a();
    },
  };

  return { gate, dialogProps, isCachedValid };
}
