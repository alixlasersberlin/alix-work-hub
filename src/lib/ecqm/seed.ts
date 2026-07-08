// Seed data helper – only if store is empty. No writes to real DB.
import { ecqm } from "./store";

export function ensureEcqmSeed() {
  if (ecqm.documents.listAll().length > 0) return;

  ecqm.documents.upsert({ number: "SOP-001", title: "Gerätewartung Alix Pro", type: "SOP", version: "1.2", status: "freigegeben", owner: "QMB", approver: "GL", validFrom: "2025-01-01", validUntil: "2027-01-01", category: "Service" });
  ecqm.documents.upsert({ number: "SOP-002", title: "CAPA-Prozess", type: "SOP", version: "1.0", status: "freigegeben", owner: "QMB", validFrom: "2024-06-01" });
  ecqm.documents.upsert({ number: "AA-014", title: "Schulungsdurchführung", type: "Arbeitsanweisung", version: "0.9", status: "pruefung", owner: "Schulungsleiter" });
  ecqm.documents.upsert({ number: "MDR-001", title: "Technische Dokumentation Alix Ultra", type: "MDR", version: "2.1", status: "freigegeben", owner: "Regulatory", validUntil: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10) });

  ecqm.processes.upsert({ code: "K-01", name: "Service & Reparatur", type: "Kern", owner: "Serviceleitung", description: "Kernprozess Servicefall bis Abnahme." });
  ecqm.processes.upsert({ code: "F-01", name: "Managementbewertung", type: "Führung", owner: "GL" });
  ecqm.processes.upsert({ code: "U-01", name: "Beschaffung", type: "Unterstützung", owner: "Einkauf" });

  ecqm.capas.upsert({ number: "CAPA-2025-001", trigger: "Reklamation", description: "Wiederholte Fehlermeldung E17 nach Firmware-Update.", rootCause: "Fehlerhafte Prüfung im Regressionsverfahren.", corrective: "Prüfschritt ergänzen.", owner: "Entwicklung", due: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), status: "in Arbeit" });
  ecqm.capas.upsert({ number: "CAPA-2025-002", trigger: "Audit", description: "Fehlende Lesebestätigungen SOP-001.", owner: "QMB", due: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), status: "offen" });

  ecqm.complaints.upsert({ number: "REK-2025-011", source: "Kunde", description: "Gerät zeigt sporadisch Fehler E17.", severity: "hoch", status: "in Bearbeitung", customerRef: "Kunde 4711", deviceRef: "SN-8823" });
  ecqm.complaints.upsert({ number: "REK-2025-012", source: "Lieferant", description: "Verzögerte Lieferung Ersatzteil ET-04.", severity: "mittel", status: "offen" });

  ecqm.risks.upsert({ number: "R-001", category: "Produktsicherheit", description: "Unerkannter Firmware-Fehler in Feldeinsatz.", probability: 3, impact: 5, owner: "Regulatory", status: "in Behandlung", actions: "Erweiterte Testabdeckung." });
  ecqm.risks.upsert({ number: "R-002", category: "Lieferkette", description: "Ausfall Kritikkomponente.", probability: 2, impact: 4, owner: "Einkauf", status: "offen" });

  ecqm.audits.upsert({ number: "AUD-2025-01", title: "Internes Audit Service", type: "Intern", scheduledFor: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), auditor: "Externer QMB", status: "geplant" });
  ecqm.audits.upsert({ number: "AUD-2025-02", title: "ISO 13485 Überwachungsaudit", type: "ISO", scheduledFor: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10), auditor: "TÜV", status: "geplant" });

  ecqm.suppliers.upsert({ name: "PhotonicsCorp GmbH", rating: 4, approved: true, isoCert: "ISO 13485", performance: 92, complaints: 1, lastAudit: "2024-11-10" });
  ecqm.suppliers.upsert({ name: "OptoParts AG", rating: 3, approved: true, isoCert: "ISO 9001", performance: 78, complaints: 3, lastAudit: "2023-09-01" });
  ecqm.suppliers.upsert({ name: "NewSource Ltd", rating: 2, approved: false, performance: 60, complaints: 5 });

  ecqm.changes.upsert({ number: "CH-2025-004", scope: "Software", description: "Firmware v3.4 – Bugfix E17.", impact: "hoch", risk: "mittel", status: "bewertet" });

  ecqm.trainings.upsert({ employee: "A. Müller", training: "SOP-001 Gerätewartung", mandatory: true, status: "absolviert", completedAt: "2025-02-15", expiresAt: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10) });
  ecqm.trainings.upsert({ employee: "B. Schmidt", training: "Datenschutz-Grundlagen", mandatory: true, status: "offen", expiresAt: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10) });
  ecqm.trainings.upsert({ employee: "C. Weber", training: "MDR-Basisschulung", mandatory: true, status: "absolviert", completedAt: "2024-10-01", expiresAt: "2026-10-01" });
}
