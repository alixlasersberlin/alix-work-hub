import { PH_ACTIVE_FIELD } from './config';

export function websiteState(product: Record<string, any>, code: string, row?: Record<string, any>) {
  const field = PH_ACTIVE_FIELD[code];
  const selected = field ? product[field] === true : !!row && row.status === 'published';
  const active = selected && row?.hold !== true;
  const snapshot = row?.remote_snapshot;
  const pending = row?.has_pending_changes === true || !!snapshot?.global_pending || !!snapshot?.global_offline_pending || !!snapshot?.beauty_offline_pending || !!snapshot?.beauty_pending || !!snapshot?.ae_pending;
  const offline = code === 'dubai' ? snapshot?.ae_direct : code === 'beautyco' ? snapshot?.beauty_offline : snapshot?.global_offline;
  const offlineConfirmed = !active && !pending && offline?.ok === true && offline?.offline === true && offline?.channel === code && (offline?.status === 'OFFLINE' || offline?.state === 'OFFLINE');
  const online = code === 'dubai' ? snapshot?.ae_direct : code === 'beautyco' ? snapshot?.beauty_online : snapshot?.global_direct;
  const onlineConfirmed = active && !pending && online?.ok === true && online?.online === true && online?.channel === code && (code === 'beautyco' ? online?.state === 'online' : online?.status === 'ONLINE');
  return {
    active,
    label: active ? 'Aktiv' : 'Inaktiv',
    confirmed: offlineConfirmed || onlineConfirmed,
    delivery: pending ? 'Übertragung ausstehend' : offlineConfirmed ? 'Webseite: OFFLINE bestätigt' : onlineConfirmed ? 'Webseite: ONLINE bestätigt' : 'Webseitenstand unbestätigt',
  };
}