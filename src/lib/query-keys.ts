/**
 * Zentrale React-Query-Keys für Dashboards und Listenansichten.
 *
 * Konvention: erste Ebene = Domäne (Tabelle/Modul), zweite Ebene = View,
 * dritte Ebene (optional) = Filter-/Param-Objekt. So lassen sich Caches
 * gezielt invalidieren, z. B. `queryClient.invalidateQueries({ queryKey: qk.customers.all })`.
 */
export const qk = {
  customers: {
    all: ['customers'] as const,
    list: (params: {
      atOnly: boolean;
      sortField: string;
      sortDir: 'asc' | 'desc';
    }) => ['customers', 'list', params] as const,
  },
  orders: {
    all: ['orders'] as const,
    bestellungenDashboard: ['orders', 'bestellungen-dashboard'] as const,
  },
  lager: {
    all: ['lager_devices'] as const,
    overview: ['lager_devices', 'overview-minimal'] as const,
  },
  productionOrders: {
    all: ['production_orders'] as const,
    list: (params: { isReclamation: boolean; atOnly: boolean }) =>
      ['production_orders', 'list', params] as const,
  },
  routePlans: {
    all: ['route_plans'] as const,
    dashboard: (date: string) => ['route_plans', 'dashboard', date] as const,
  },
  dashboard: {
    main: (flags: {
      canSeeOrders: boolean;
      canSeeRoutes: boolean;
      canSeeFinance: boolean;
      canSeeCustomers: boolean;
      canSeeAudit: boolean;
      isAdmin: boolean;
      atOnly: boolean;
    }) => ['dashboard', 'main', flags] as const,
  },
} as const;

/**
 * Stale-Time-Profile in Millisekunden. Inhalte mit hoher Lese-/Wechselfrequenz
 * bekommen `short`; eher statische Tabellen `long`.
 */
export const STALE = {
  short: 30_000,         // 30 s – Echtzeit-Listen
  medium: 2 * 60_000,    // 2 min – Standard-Dashboards
  long: 10 * 60_000,     // 10 min – Stammdaten (Kunden, Artikel)
} as const;
