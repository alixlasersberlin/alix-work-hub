import { useEffect, useState } from "react";

export type InfinityNotification = {
  id: string;
  title: string;
  body?: string;
  kind?: "info" | "success" | "warning" | "error";
  href?: string;
  module?: string;
  createdAt: number;
  read?: boolean;
};

type Listener = (list: InfinityNotification[]) => void;

const KEY = "alixwork.notifications.v1";
const MAX = 50;

let state: InfinityNotification[] = load();
const listeners = new Set<Listener>();

function load(): InfinityNotification[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.slice(0, MAX)));
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l(state));
}

export const notifyBus = {
  push(n: Omit<InfinityNotification, "id" | "createdAt" | "read">) {
    const item: InfinityNotification = {
      ...n,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      read: false,
    };
    state = [item, ...state].slice(0, MAX);
    persist();
    return item.id;
  },
  markRead(id: string) {
    state = state.map((n) => (n.id === id ? { ...n, read: true } : n));
    persist();
  },
  markAllRead() {
    state = state.map((n) => ({ ...n, read: true }));
    persist();
  },
  remove(id: string) {
    state = state.filter((n) => n.id !== id);
    persist();
  },
  clear() {
    state = [];
    persist();
  },
  get() {
    return state;
  },
};

export function useNotifications() {
  const [list, setList] = useState<InfinityNotification[]>(state);
  useEffect(() => {
    const l: Listener = (next) => setList([...next]);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const unread = list.filter((n) => !n.read).length;
  return {
    list,
    items: list, // back-compat alias
    unread,
    unreadCount: unread, // back-compat alias
    ...notifyBus,
  };
}
