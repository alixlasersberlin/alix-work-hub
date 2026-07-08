import { Rc1Header, Rc1Card, Bullets } from "@/components/rc1/Rc1Section";

type Info = { title: string; subtitle: string; sections: { title: string; items: string[] }[] };
const PAGES: Record<string, Info> = {
  navigation: { title: "Enterprise Navigation", subtitle: "Einheitliche Menüs, Breadcrumbs, Quick Search, Favoriten & Recents.",
    sections: [
      { title: "Gruppierung", items: ["Operativ · Vertrieb · Service · Verwaltung · Analytics · Compliance · Integrations"] },
      { title: "Komponenten", items: ["Sidebar", "Breadcrumbs", "Command Palette", "Favoriten-Chips", "Zuletzt verwendet"] },
    ] },
  notifications: { title: "Benachrichtigungszentrale", subtitle: "E-Mail · SMS · WhatsApp · Push · System · API · Kalender · Freigaben · Tickets.",
    sections: [{ title: "Funktionen", items: ["Filter", "Suche", "Prioritäten", "Snooze", "Read/Unread", "Kanalstatistik"] }] },
  performance: { title: "Performance Optimierung", subtitle: "Analyse und sichere Optimierungen aller Module.",
    sections: [{ title: "Maßnahmen", items: ["Lazy Loading (Route-Splitting aktiv)", "Server-Pagination", "Caching (react-query)", "Code Splitting", "Virtualisierung großer Listen", "Async Berechnungen", "DB-Abfragen tunen", "Bundle-Größe reduzieren"] }] },
  database: { title: "Datenbankoptimierung", subtitle: "Nur Empfehlungen, keine Migrationen.",
    sections: [{ title: "Prüfungen", items: ["Indizes", "Joins", "Abfragen", "Referenzen (FK)", "Soft-Delete", "Archivierung"] }] },
  security: { title: "Sicherheit", subtitle: "Authentifizierung, Sessions, Rate Limits, Audit, Uploads.",
    sections: [{ title: "Bereiche", items: ["Auth", "Autz/RBAC", "Berechtigungen", "Sessions", "CSRF", "XSS", "SQL/Command Injection", "Rate Limits", "Audit", "Token-Rotation", "Datei-Upload-Scan"] }] },
  permissions: { title: "Rechteprüfung", subtitle: "Jede Seite, jeder Button, jede API prüfen.",
    sections: [{ title: "Ergebnis", items: ["RBAC vollständig", "Row-Level-Security aktiv", "Delete nur Super Admin", "Exporte gescoped"] }] },
  accessibility: { title: "Accessibility", subtitle: "WCAG-Ausrichtung, Tastatur, Screenreader, Fokus, Kontraste.",
    sections: [{ title: "Bereiche", items: ["ARIA Labels", "Focus Trap Dialoge", "Kontrast-Tokens", "Tastaturbedienung", "Fehler-Announcements"] }] },
  mobile: { title: "Mobile Optimierung", subtitle: "iPhone · iPad · Android · Tablets · Desktop.",
    sections: [{ title: "Prüfpunkte", items: ["Responsive Breakpoints", "Touch-Targets ≥44px", "PWA-Fallbacks", "Offline-Outbox EMP"] }] },
  errors: { title: "Fehlerbehandlung", subtitle: "Benutzerfreundliche Meldungen, Fehler-IDs, Retry & Support.",
    sections: [{ title: "Elemente", items: ["Toast + Detail-Dialog", "Fehler-ID (UUID)", "Retry-Button", "Kontakt-Support-Link"] }] },
  logging: { title: "Logging", subtitle: "System, API, User, Import, Workflows, Sync, Queues, Fehler, Performance.",
    sections: [{ title: "Speicher", items: ["Strukturiert (JSON)", "Retention konfigurierbar", "Audit-Trail unveränderlich"] }] },
  monitoring: { title: "Monitoring", subtitle: "System-, API-, Queue-Status, Integrationen, Antwortzeiten.",
    sections: [{ title: "Alarme", items: ["Threshold-Alerts", "Kritische Fehler → Push/E-Mail", "SLA-Dashboards"] }] },
  releases: { title: "Release Management", subtitle: "Development · Testing · Staging · Production.",
    sections: [{ title: "Prozess", items: ["Versionierung (semver)", "Release Notes", "Freeze-Fenster", "Rollback-Plan"] }] },
  installer: { title: "Installer (Erstinstallation)", subtitle: "Mandanten, Administrator, Branding, SMTP, Standorte, Lizenz, Module.",
    sections: [{ title: "Vorbereitung", items: ["Assistent (Schritte 1–7)", "Konfig-Export", "Trockenlauf"] }] },
  migration: { title: "Migrationstools", subtitle: "Datenimport, Version Upgrade, Validierung, Rollback, Logs.",
    sections: [{ title: "Werkzeuge", items: ["Import-Wizard", "Dry-Run", "Schema-Diff", "Migrations-Log"] }] },
  docs: { title: "Dokumentation", subtitle: "Systemübersicht, Module, APIs, Workflows, Rollen, Datenmodell.",
    sections: [{ title: "Aufbau", items: ["Getting Started", "Rollen & Berechtigungen", "Modul-Handbücher", "Glossar"] }] },
  devdocs: { title: "Entwicklerdokumentation", subtitle: "OpenAPI, Architektur, Events, Deployment, Guidelines.",
    sections: [{ title: "Inhalte", items: ["OpenAPI 3", "Architekturdiagramme", "API-Beispiele", "Event-Katalog", "Deployment-Hinweise", "Coding Guidelines"] }] },
  "design-review": { title: "Enterprise Design Review", subtitle: "Aurora UI vereinheitlichen – Abstände, Buttons, Farben, Typo, Tabellen, Dialoge.",
    sections: [{ title: "Ergebnis", items: ["Design-Tokens zentral", "shadcn Varianten normalisiert", "Motion-Presets", "Formular-Layouts einheitlich"] }] },
  i18n: { title: "Mehrsprachigkeit", subtitle: "Vorbereitung für DE, EN, TR, AR, RU, VI und weitere.",
    sections: [{ title: "Konzept", items: ["Übersetzungsdateien pro Sprache", "Keine hartcodierten Texte", "RTL-Layout (AR) vorbereitet", "Pluralformen"] }] },
  backup: { title: "Backup & Recovery", subtitle: "Backups, Restore, Versionierung, Export, Archiv, DR.",
    sections: [{ title: "Prozesse", items: ["Tägliches Vollbackup", "Point-in-time Restore", "Offsite-Archiv", "DR-Runbook"] }] },
  startseite: { title: "Enterprise Startseite", subtitle: "Personalisierte Startseite nach Login.",
    sections: [{ title: "Elemente", items: ["Widgets", "Schnellzugriffe", "Zuletzt geöffnet", "Aufgaben", "Benachrichtigungen", "Termine"] }] },
  future: { title: "Zukunftssicherheit", subtitle: "Architektur vorbereitet für KI, IoT, Digital Twins, ERP, BI, Multi-Cloud, Plugins.",
    sections: [{ title: "Vorbereitet", items: ["Event Bus (EIG)", "Plugin-Slots", "AI-Agents-Runtime", "White-Label Tenants", "Marketplace-API"] }] },
};

export function makeInfoPage(key: string) {
  const info = PAGES[key];
  return function Page() {
    if (!info) return <div>Unbekannt</div>;
    return (
      <>
        <Rc1Header title={info.title} subtitle={info.subtitle} />
        <div className="grid gap-4 md:grid-cols-2">
          {info.sections.map(sec => (
            <Rc1Card key={sec.title} title={sec.title}><Bullets items={sec.items} /></Rc1Card>
          ))}
        </div>
      </>
    );
  };
}

export const Rc1Navigation = makeInfoPage("navigation");
export const Rc1Notifications = makeInfoPage("notifications");
export const Rc1Performance = makeInfoPage("performance");
export const Rc1Database = makeInfoPage("database");
export const Rc1Security = makeInfoPage("security");
export const Rc1Permissions = makeInfoPage("permissions");
export const Rc1Accessibility = makeInfoPage("accessibility");
export const Rc1Mobile = makeInfoPage("mobile");
export const Rc1Errors = makeInfoPage("errors");
export const Rc1Logging = makeInfoPage("logging");
export const Rc1Monitoring = makeInfoPage("monitoring");
export const Rc1Releases = makeInfoPage("releases");
export const Rc1Installer = makeInfoPage("installer");
export const Rc1Migration = makeInfoPage("migration");
export const Rc1Docs = makeInfoPage("docs");
export const Rc1DevDocs = makeInfoPage("devdocs");
export const Rc1DesignReview = makeInfoPage("design-review");
export const Rc1I18n = makeInfoPage("i18n");
export const Rc1Backup = makeInfoPage("backup");
export const Rc1Startseite = makeInfoPage("startseite");
export const Rc1Future = makeInfoPage("future");
