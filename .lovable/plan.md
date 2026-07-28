# ALIXDocs Enterprise 3.0

## Entscheidungen (bestätigt)
- **Editor**: Lightweight — TipTap (Rich Text/Word-Like), Univer (Excel-Like Sheets), einfache PPT-Slide-Ansicht mit TipTap-Slides. Kein voller .docx-Roundtrip; .docx/.xlsx werden als PDF-Vorschau + editierbare Konvertierung angeboten.
- **Konsolidierung**: `alixdocs2_*` wird die einzige Basis. `alixdocs_*` (Legacy) wird per Migration in `alixdocs2_*` überführt und danach schreibgeschützt.
- **Scope**: Alle 7 Phasen (E1–E7).

## Konsolidierungs-Schritt (vor E1)
1. Migration `alixdocs_documents` → `alixdocs2_documents` (Mapping IDs, Kategorien, Versionen, Approval-States, Shares).
2. Legacy-Views bleiben lesbar; alle neuen Writes gehen in `alixdocs2_*`.
3. Routen `/alixdocs` und `/alixdocs2` → einheitlich unter `/alixdocs` (E1-Dashboard), Legacy-Reader unter `/alixdocs/legacy`.

## Phase E1 — Enterprise Dashboard & Globale Suche
- Neue Landing `/alixdocs`: KPI-Kacheln (Dokumente gesamt, offene Freigaben, meine Aufgaben, letzte Aktivität, Speicherverbrauch).
- Global Search Bar (Header): Volltext (bestehendes `alixdocs2_fts_search`) + Filter (Doctype, Owner, Datum, Tag, Modul).
- Recent/Pinned/Favorites-Sektionen.

## Phase E2 — Chat, Comments, @Mentions, Tasks
- Nutzt bestehendes `alixdocs2_comments`.
- Neu: `alixdocs2_tasks` (Titel, Assignee, Due, Status, doc_id).
- @Mentions triggern `app_notifications` + Email.
- Sidebar-Panel „Diskussion & Aufgaben" in jedem Doc.

## Phase E3 — Workflow Engine & Version Diff
- Konfigurierbare Workflows (`alixdocs2_workflows`, `_workflow_steps`, `_workflow_runs`): sequentiell/parallel, Reminder, Fristen.
- Version-Diff (Text via `diff-match-patch`) für TipTap-Dokumente; für PDFs Side-by-Side-Vergleich.

## Phase E4 — AI Copilot
- Edge Function `alixdocs-copilot` (Lovable AI Gateway, `openai/gpt-5.6-sol`, reasoningEffort none).
- Aktionen: Zusammenfassen, Klassifizieren, Risiken, Fragen-zum-Dokument (RAG über OCR-Text).
- UI-Panel „Copilot" im Doc-Viewer.

## Phase E5 — Semantic Search & OCR-Ausbau
- OCR bestehend (Tesseract via Edge Function) auf alle neuen Uploads ausrollen; Backfill-Job.
- Embeddings (`text-embedding-3-small` via Gateway) in `alixdocs2_embeddings` (pgvector).
- Hybrid Search: BM25 (FTS) + Vektor-Rerank.

## Phase E6 — Office Editor
- TipTap Editor Route `/alixdocs/edit/:id` mit Auto-Save (Versionen).
- Univer Sheets Route `/alixdocs/sheet/:id`.
- Import: .docx via Mammoth → HTML → TipTap; .xlsx via SheetJS → Univer.
- Export: PDF (bestehend), HTML, .docx (best-effort via html-docx-js).

## Phase E7 — Live Collaboration & Mobile
- Y.js + Supabase Realtime Provider für TipTap (Presence, Cursor, CRDT).
- Für Univer analog mit dessen Collab-Plugin.
- Mobile: Responsive Doc-Viewer, Kommentare, Freigaben, Signaturen mobil.

## Technische Details
- Neue Tabellen (alle mit RLS + GRANT): `alixdocs2_tasks`, `alixdocs2_workflows`, `alixdocs2_workflow_steps`, `alixdocs2_workflow_runs`, `alixdocs2_embeddings (vector(1536))`, `alixdocs2_favorites`, `alixdocs2_activity`.
- Neue Edge Functions: `alixdocs-copilot`, `alixdocs-embed`, `alixdocs-ocr-backfill`, `alixdocs-workflow-tick` (Cron).
- Neue Client-Deps: `@tiptap/*`, `@univerjs/*`, `yjs`, `y-supabase`, `mammoth`, `xlsx`, `diff-match-patch`, `html-docx-js`.
- Bestehende Menüs: „Dokumente" → zeigt nur noch neuen Hub `/alixdocs`.

## Rollout-Reihenfolge (bitte bestätigen)
1. Konsolidierungs-Migration + neuer Hub (E1)  ← **Start jetzt**
2. E2 Tasks/Mentions
3. E3 Workflow + Diff
4. E4 Copilot
5. E5 Semantik + OCR-Backfill
6. E6 Editors
7. E7 Live Collab + Mobile

Ich fange nach Deiner Bestätigung mit **Konsolidierung + E1** an. Sag „go", oder nenne eine andere Startphase.
