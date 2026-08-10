// ALIX SOFTWARE COMPLIANCE — IEC 62304 Feldkonfiguration
import { PlmField } from '@/lib/plm/config';

export const SAFETY_CLASSES = ['A', 'B', 'C'];
export const TEST_RESULTS = ['offen', 'pass', 'fail', 'blockiert', 'nicht_anwendbar'];
export const REQ_STATUS = ['entwurf', 'in_pruefung', 'freigegeben', 'geaendert', 'entfallen'];
export const VERIFY_STATUS = ['offen', 'in_pruefung', 'verifiziert', 'abweichung'];
export const PRIORITIES = ['niedrig', 'mittel', 'hoch', 'sicherheitskritisch'];
export const REQ_SOURCES = ['medical_requirement', 'system_requirement', 'risk_control', 'norm', 'kunde', 'intern'];
export const BUG_SEVERITY = ['niedrig', 'mittel', 'hoch', 'kritisch'];
export const BUG_STATUS = ['offen', 'in_bearbeitung', 'behoben', 'verifiziert', 'geschlossen', 'abgelehnt'];
export const RELEASE_STATE = ['entwurf', 'in_test', 'freigegeben', 'gesperrt', 'archiviert'];
export const HW_DOC_KINDS = [
  'isolationsdiagramm', 'gerber', 'pcb_layout', 'pinout', 'schematic', 'pcb_revision',
  'bom', 'power_supply', 'mainboard', 'laser_driver', 'cooling_controller',
  'display_controller', 'sensor_board', 'sonstiges',
];
export const IDES = ['STM32CubeIDE', 'Keil', 'Visual Studio', 'Qt', 'Android Studio', 'Other'];
export const VCS = ['GitHub', 'GitLab', 'Bitbucket', 'Local Git', 'SVN', 'None'];
export const TEST_GROUPS = [
  'Startup', 'Shutdown', 'Emergency Stop', 'Laser Enable', 'Footswitch', 'Cooling', 'Temperature',
  'Water Flow', 'Interlock', 'Treatment Timer', 'Energy Setting', 'Wavelength Selection',
  'AI Parameter Selection', 'Manual Parameter Override', 'Error Handling', 'Power Failure',
  'Restart', 'Communication Failure', 'Sensor Failure', 'Overtemperature', 'Treatment Logging',
  'Service Mode', 'User Permissions', 'Software Update', 'Version Display', 'Alarm Conditions',
  'Boundary Values', 'Invalid Inputs',
];

const deviceField: PlmField = {
  key: 'device_id', label: 'Gerät', type: 'ref', refTable: 'plm_devices',
  refLabel: 'name', refExtra: 'article_number', list: true,
};

export const swUnitFields: PlmField[] = [
  { key: 'unit_code', label: 'SW-UNIT-ID', list: true, mono: true, required: true },
  deviceField,
  { key: 'name', label: 'Name', list: true, required: true },
  { key: 'description', label: 'Beschreibung', type: 'textarea' },
  { key: 'version', label: 'Version', list: true, mono: true },
  { key: 'safety_class', label: 'Safety Classification', type: 'select', options: SAFETY_CLASSES, list: true },
  { key: 'owner', label: 'Owner', list: true },
  { key: 'source_location', label: 'Source Code Location', group: 'Technik' },
  { key: 'inputs', label: 'Inputs', type: 'textarea', group: 'Technik' },
  { key: 'outputs', label: 'Outputs', type: 'textarea', group: 'Technik' },
  { key: 'dependencies', label: 'Dependencies', type: 'textarea', group: 'Technik' },
  { key: 'verification_status', label: 'Verification Status', type: 'select', options: VERIFY_STATUS, list: true, group: 'Technik' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Technik' },
];

export const swRequirementFields: PlmField[] = [
  { key: 'req_code', label: 'SW-REQ-ID', list: true, mono: true, required: true },
  deviceField,
  { key: 'title', label: 'Titel', list: true, required: true },
  { key: 'description', label: 'Beschreibung', type: 'textarea' },
  { key: 'source', label: 'Quelle', type: 'select', options: REQ_SOURCES, list: true, group: 'Einordnung' },
  { key: 'priority', label: 'Priorität', type: 'select', options: PRIORITIES, list: true, group: 'Einordnung' },
  { key: 'safety_related', label: 'Sicherheitsrelevant', type: 'boolean', group: 'Einordnung' },
  { key: 'unit_id', label: 'Software Unit', type: 'ref', refTable: 'plm_sw_units', refLabel: 'name', refExtra: 'unit_code', list: true, group: 'Einordnung' },
  { key: 'verification_method', label: 'Verification Method', group: 'Verifikation' },
  { key: 'acceptance_criteria', label: 'Acceptance Criteria', type: 'textarea', group: 'Verifikation' },
  { key: 'status', label: 'Status', type: 'select', options: REQ_STATUS, list: true, group: 'Steuerung' },
  { key: 'version', label: 'Version', mono: true, group: 'Steuerung' },
  { key: 'responsible', label: 'Verantwortlich', group: 'Steuerung' },
];

export const swRiskFields: PlmField[] = [
  { key: 'risk_code', label: 'RISK-ID', list: true, mono: true, required: true },
  deviceField,
  { key: 'hazard', label: 'Hazard', list: true, required: true },
  { key: 'hazardous_situation', label: 'Hazardous Situation', type: 'textarea', group: 'Analyse' },
  { key: 'sequence_of_events', label: 'Sequence of Events', type: 'textarea', group: 'Analyse' },
  { key: 'potential_harm', label: 'Potential Harm', type: 'textarea', group: 'Analyse' },
  { key: 'severity', label: 'Severity 1–5', type: 'number', list: true, group: 'Bewertung' },
  { key: 'probability', label: 'Probability 1–5', type: 'number', list: true, group: 'Bewertung' },
  { key: 'risk_control', label: 'Risk Control', type: 'textarea', group: 'Beherrschung' },
  { key: 'requirement_id', label: 'Software Requirement', type: 'ref', refTable: 'plm_sw_requirements', refLabel: 'title', refExtra: 'req_code', list: true, group: 'Beherrschung' },
  { key: 'unit_id', label: 'Software Unit', type: 'ref', refTable: 'plm_sw_units', refLabel: 'name', refExtra: 'unit_code', group: 'Beherrschung' },
  { key: 'plm_risk_id', label: 'ISO-14971-Risiko', type: 'ref', refTable: 'plm_risks', refLabel: 'hazard', refExtra: 'risk_number', group: 'Beherrschung' },
  { key: 'verification', label: 'Risk Control Verification', type: 'textarea', group: 'Restrisiko' },
  { key: 'residual_severity', label: 'Restrisiko Severity', type: 'number', group: 'Restrisiko' },
  { key: 'residual_probability', label: 'Restrisiko Probability', type: 'number', group: 'Restrisiko' },
  { key: 'acceptable', label: 'Restrisiko akzeptabel', type: 'boolean', list: true, group: 'Restrisiko' },
  { key: 'responsible', label: 'Verantwortlich', group: 'Steuerung' },
  { key: 'review_date', label: 'Review-Datum', type: 'date', group: 'Steuerung' },
  { key: 'status', label: 'Status', type: 'select', options: ['offen', 'in_bearbeitung', 'bewertet', 'freigegeben', 'geschlossen'], list: true, group: 'Steuerung' },
];

export function swTestFields(kind: 'verification' | 'integration' | 'system'): PlmField[] {
  const prefix = kind === 'verification' ? 'SW-VER' : kind === 'integration' ? 'SW-INT' : 'SW-SYS';
  return [
    { key: 'test_code', label: `${prefix}-ID`, list: true, mono: true, required: true },
    deviceField,
    { key: 'title', label: 'Testfall', list: true, required: true },
    ...(kind === 'system'
      ? [{ key: 'test_group', label: 'Testgruppe', type: 'select', options: TEST_GROUPS, list: true } as PlmField]
      : [{ key: 'test_group', label: 'Testgruppe', list: true } as PlmField]),
    { key: 'requirement_id', label: 'Requirement', type: 'ref', refTable: 'plm_sw_requirements', refLabel: 'title', refExtra: 'req_code', list: true, group: 'Verknüpfung' },
    { key: 'unit_id', label: 'Software Unit', type: 'ref', refTable: 'plm_sw_units', refLabel: 'name', refExtra: 'unit_code', group: 'Verknüpfung' },
    { key: 'risk_id', label: 'Risiko', type: 'ref', refTable: 'plm_sw_risks', refLabel: 'hazard', refExtra: 'risk_code', group: 'Verknüpfung' },
    { key: 'preconditions', label: 'Vorbedingungen', type: 'textarea', group: 'Testfall' },
    { key: 'steps', label: 'Testschritte', type: 'textarea', group: 'Testfall' },
    { key: 'expected_result', label: 'Expected Result', type: 'textarea', group: 'Testfall' },
    { key: 'executed_confirmed', label: 'Test wurde tatsächlich durchgeführt', type: 'boolean', list: true, group: 'Durchführung' },
    { key: 'actual_result', label: 'Actual Result (nur nach Durchführung)', type: 'textarea', group: 'Durchführung' },
    { key: 'result', label: 'Final Result', type: 'select', options: TEST_RESULTS, list: true, group: 'Durchführung' },
    { key: 'tester', label: 'Tester', list: true, group: 'Durchführung' },
    { key: 'test_date', label: 'Testdatum', type: 'date', group: 'Durchführung' },
    { key: 'sw_version', label: 'Software Version', mono: true, group: 'Durchführung' },
    { key: 'hw_version', label: 'Hardware Version', mono: true, group: 'Durchführung' },
    { key: 'evidence_path', label: 'Evidence (Video / Screenshot / Log)', type: 'file', group: 'Durchführung' },
    { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Durchführung' },
  ];
}

export const swBugFields: PlmField[] = [
  { key: 'bug_code', label: 'BUG-ID', list: true, mono: true, required: true },
  deviceField,
  { key: 'title', label: 'Titel', list: true, required: true },
  { key: 'description', label: 'Beschreibung', type: 'textarea' },
  { key: 'sw_version', label: 'Software Version', mono: true, list: true, group: 'Einordnung' },
  { key: 'unit_id', label: 'Betroffene Software Unit', type: 'ref', refTable: 'plm_sw_units', refLabel: 'name', refExtra: 'unit_code', list: true, group: 'Einordnung' },
  { key: 'requirement_id', label: 'Betroffenes Requirement', type: 'ref', refTable: 'plm_sw_requirements', refLabel: 'title', refExtra: 'req_code', group: 'Einordnung' },
  { key: 'risk_id', label: 'Betroffenes Risiko', type: 'ref', refTable: 'plm_sw_risks', refLabel: 'hazard', refExtra: 'risk_code', group: 'Einordnung' },
  { key: 'severity', label: 'Severity', type: 'select', options: BUG_SEVERITY, list: true, group: 'Einordnung' },
  { key: 'reporter', label: 'Reporter', group: 'Bearbeitung' },
  { key: 'reported_at', label: 'Gemeldet am', type: 'date', list: true, group: 'Bearbeitung' },
  { key: 'status', label: 'Status', type: 'select', options: BUG_STATUS, list: true, group: 'Bearbeitung' },
  { key: 'root_cause', label: 'Root Cause', type: 'textarea', group: 'Bearbeitung' },
  { key: 'correction', label: 'Correction', type: 'textarea', group: 'Bearbeitung' },
  { key: 'capa', label: 'CAPA', type: 'textarea', group: 'Bearbeitung' },
  { key: 'verification', label: 'Verification', type: 'textarea', group: 'Bearbeitung' },
  { key: 'released_version', label: 'Behoben in Version', mono: true, group: 'Bearbeitung' },
];

export const swReleaseFields: PlmField[] = [
  { key: 'version', label: 'Version', list: true, mono: true, required: true },
  deviceField,
  { key: 'release_date', label: 'Release Date', type: 'date', list: true },
  { key: 'developer', label: 'Developer', list: true },
  { key: 'git_commit', label: 'Git Commit', mono: true, group: 'Technik' },
  { key: 'firmware_hash', label: 'Firmware Hash', mono: true, group: 'Technik' },
  { key: 'device_compatibility', label: 'Device Compatibility', group: 'Technik' },
  { key: 'changed_requirements', label: 'Changed Requirements', type: 'textarea', group: 'Inhalt' },
  { key: 'changed_units', label: 'Changed Units', type: 'textarea', group: 'Inhalt' },
  { key: 'fixed_bugs', label: 'Fixed Bugs', type: 'textarea', group: 'Inhalt' },
  { key: 'new_risks', label: 'New Risks', type: 'textarea', group: 'Inhalt' },
  { key: 'tests_required', label: 'Tests required', type: 'number', list: true, group: 'Freigabe' },
  { key: 'tests_passed', label: 'Tests passed', type: 'number', list: true, group: 'Freigabe' },
  { key: 'approved_by', label: 'Release approved by', group: 'Freigabe' },
  { key: 'status', label: 'Status', type: 'select', options: RELEASE_STATE, list: true, group: 'Freigabe' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Freigabe' },
];

export const swTeamFields: PlmField[] = [
  { key: 'name', label: 'Name', list: true, required: true },
  deviceField,
  { key: 'team', label: 'Team', type: 'select', options: ['software', 'hardware'], list: true },
  { key: 'is_lead', label: 'Team Lead', type: 'boolean', list: true },
  { key: 'company', label: 'Company', list: true },
  { key: 'position', label: 'Position / Role', list: true },
  { key: 'email', label: 'E-Mail' },
  { key: 'ide', label: 'IDE', type: 'select', options: IDES, group: 'Entwicklungsumgebung' },
  { key: 'version_control', label: 'Version Control', type: 'select', options: VCS, list: true, group: 'Entwicklungsumgebung' },
  { key: 'versioning_scheme', label: 'Versioning Scheme (falls kein VCS, z. B. Major.Minor.Patch)', group: 'Entwicklungsumgebung' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Entwicklungsumgebung' },
];

export const hwDocFields: PlmField[] = [
  { key: 'title', label: 'Titel', list: true, required: true },
  deviceField,
  { key: 'doc_kind', label: 'Dokumentart', type: 'select', options: HW_DOC_KINDS, list: true },
  { key: 'board', label: 'Baugruppe / Board', list: true },
  { key: 'version', label: 'Version', mono: true, list: true },
  { key: 'revision', label: 'Revision', mono: true },
  { key: 'file_path', label: 'Datei', type: 'file' },
  { key: 'approval_status', label: 'Freigabestatus', type: 'select', options: ['entwurf', 'in_pruefung', 'freigegeben', 'gesperrt', 'archiviert'], list: true, group: 'Freigabe' },
  { key: 'released_by', label: 'Freigegeben von', group: 'Freigabe' },
  { key: 'released_at', label: 'Freigegeben am', type: 'date', group: 'Freigabe' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Freigabe' },
];

export const swSurveyFields: PlmField[] = [
  { key: 'respondent_id', label: 'Respondent ID', list: true, mono: true, required: true },
  deviceField,
  { key: 'survey_date', label: 'Datum', type: 'date', list: true },
  { key: 'serial_number', label: 'Seriennummer', list: true, mono: true },
  { key: 'sw_version', label: 'Softwareversion', list: true, mono: true },
  { key: 'original_file_path', label: 'Originaldatei (PDF / Excel)', type: 'file' },
  { key: 'original_answers', label: 'Original-Antworten (niemals überschreiben)', type: 'textarea', group: 'Original' },
  { key: 'evaluation', label: 'Auswertung', type: 'textarea', group: 'Auswertung' },
  { key: 'risk_signal', label: 'Potential Risk Signal', type: 'boolean', list: true, group: 'Auswertung' },
  { key: 'capa_required', label: 'CAPA Required', type: 'boolean', list: true, group: 'Auswertung' },
  { key: 'software_issue', label: 'Software Issue', type: 'boolean', list: true, group: 'Auswertung' },
  { key: 'usability_issue', label: 'Usability Issue', type: 'boolean', list: true, group: 'Auswertung' },
];

// ===== Ergänzungen IEC 62304: SOUP, Pläne, Anomalien, Problem Reports, Risiko-Maßnahmen, Klassifizierung, E-Signatur =====
export const SOUP_STATUS = ['in_pruefung', 'freigegeben', 'gesperrt', 'ersetzt', 'archiviert'];
export const PLAN_KINDS = ['development_plan', 'configuration_management_plan', 'maintenance_plan', 'problem_resolution_plan', 'verification_plan', 'risk_management_plan'];
export const PLAN_STATUS = ['entwurf', 'in_pruefung', 'freigegeben', 'ueberarbeitung', 'archiviert'];
export const ANOMALY_STATUS = ['offen', 'akzeptiert', 'geplant_behoben', 'behoben', 'geschlossen'];
export const PROBLEM_SOURCES = ['post_market', 'kunde', 'service', 'anwenderbefragung', 'intern', 'audit', 'vigilanz'];
export const PROBLEM_STATUS = ['offen', 'in_untersuchung', 'korrektur_umgesetzt', 'wirksamkeit_geprueft', 'geschlossen', 'abgelehnt'];
export const MEASURE_TYPES = ['software_control', 'hardware_control', 'information_for_safety', 'design_change', 'prozess'];
export const MEASURE_STATUS = ['offen', 'in_umsetzung', 'umgesetzt', 'wirksam', 'nicht_wirksam'];
export const SIGN_MEANINGS = ['freigabe', 'pruefung', 'genehmigung', 'kenntnisnahme', 'testabnahme'];

const dev = deviceField;

export const swSoupFields: PlmField[] = [
  { key: 'soup_code', label: 'SOUP-ID', list: true, mono: true },
  dev,
  { key: 'name', label: 'Bibliothek / Komponente', list: true, required: true },
  { key: 'vendor', label: 'Hersteller / Quelle', list: true },
  { key: 'version', label: 'Version', list: true, mono: true },
  { key: 'license', label: 'Lizenz', list: true },
  { key: 'source_url', label: 'Bezugsquelle (URL)' },
  { key: 'purpose', label: 'Zweck / Verwendung', type: 'textarea', group: 'Anforderungen' },
  { key: 'functional_requirements', label: 'Funktionale Anforderungen (62304 §5.3.3)', type: 'textarea', group: 'Anforderungen' },
  { key: 'hardware_requirements', label: 'Hardware-/Systemanforderungen', type: 'textarea', group: 'Anforderungen' },
  { key: 'safety_class', label: 'Safety Class', type: 'select', options: SAFETY_CLASSES, list: true, group: 'Bewertung' },
  { key: 'known_anomalies', label: 'Bekannte Anomalien (Anomalienliste)', type: 'textarea', group: 'Bewertung' },
  { key: 'anomaly_evaluation', label: 'Bewertung der Anomalien', type: 'textarea', group: 'Bewertung' },
  { key: 'risk_assessment', label: 'Risikobewertung', type: 'textarea', group: 'Bewertung' },
  { key: 'verification', label: 'Verifikation der Eignung', type: 'textarea', group: 'Bewertung' },
  { key: 'update_strategy', label: 'Update-/Monitoring-Strategie', type: 'textarea', group: 'Steuerung' },
  { key: 'eol_date', label: 'End of Life', type: 'date', group: 'Steuerung' },
  { key: 'responsible', label: 'Verantwortlich', group: 'Steuerung' },
  { key: 'status', label: 'Status', type: 'select', options: SOUP_STATUS, list: true, group: 'Steuerung' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Steuerung' },
];

export const swPlanFields: PlmField[] = [
  { key: 'plan_code', label: 'Plan-ID', list: true, mono: true },
  dev,
  { key: 'title', label: 'Titel', list: true, required: true },
  { key: 'plan_kind', label: 'Planart', type: 'select', options: PLAN_KINDS, list: true },
  { key: 'version', label: 'Version', list: true, mono: true },
  { key: 'scope', label: 'Geltungsbereich', type: 'textarea', group: 'Inhalt' },
  { key: 'lifecycle_model', label: 'Lebenszyklusmodell', type: 'textarea', group: 'Inhalt' },
  { key: 'deliverables', label: 'Deliverables / Dokumente', type: 'textarea', group: 'Inhalt' },
  { key: 'activities', label: 'Aktivitäten & Meilensteine', type: 'textarea', group: 'Inhalt' },
  { key: 'roles_responsibilities', label: 'Rollen & Verantwortlichkeiten', type: 'textarea', group: 'Inhalt' },
  { key: 'tools_environment', label: 'Werkzeuge & Umgebung', type: 'textarea', group: 'Inhalt' },
  { key: 'configuration_items', label: 'Konfigurationseinheiten (SCMP)', type: 'textarea', group: 'Konfigurationsmanagement' },
  { key: 'change_control', label: 'Änderungslenkung', type: 'textarea', group: 'Konfigurationsmanagement' },
  { key: 'problem_resolution', label: 'Problem-Resolution-Prozess', type: 'textarea', group: 'Konfigurationsmanagement' },
  { key: 'maintenance_strategy', label: 'Wartungsstrategie (62304 §6)', type: 'textarea', group: 'Konfigurationsmanagement' },
  { key: 'file_path', label: 'Dokument', type: 'file', group: 'Freigabe' },
  { key: 'status', label: 'Status', type: 'select', options: PLAN_STATUS, list: true, group: 'Freigabe' },
  { key: 'approved_by', label: 'Freigegeben von', group: 'Freigabe' },
  { key: 'approved_at', label: 'Freigegeben am', type: 'date', group: 'Freigabe' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Freigabe' },
];

export const swAnomalyFields: PlmField[] = [
  { key: 'anomaly_code', label: 'ANO-ID', list: true, mono: true },
  dev,
  { key: 'release_id', label: 'Release', type: 'ref', refTable: 'plm_sw_releases', refLabel: 'version', refExtra: 'status', list: true },
  { key: 'title', label: 'Anomalie', list: true, required: true },
  { key: 'description', label: 'Beschreibung', type: 'textarea' },
  { key: 'bug_id', label: 'Zugehöriger Bug', type: 'ref', refTable: 'plm_sw_bugs', refLabel: 'title', refExtra: 'bug_code', group: 'Bewertung' },
  { key: 'severity', label: 'Severity', type: 'select', options: BUG_SEVERITY, list: true, group: 'Bewertung' },
  { key: 'safety_relevant', label: 'Sicherheitsrelevant', type: 'boolean', list: true, group: 'Bewertung' },
  { key: 'risk_evaluation', label: 'Risikobewertung zum Freigabezeitpunkt', type: 'textarea', group: 'Bewertung' },
  { key: 'workaround', label: 'Workaround', type: 'textarea', group: 'Bewertung' },
  { key: 'planned_fix_version', label: 'Behebung geplant in Version', mono: true, group: 'Freigabe' },
  { key: 'accepted_by', label: 'Akzeptiert von', group: 'Freigabe' },
  { key: 'accepted_at', label: 'Akzeptiert am', type: 'date', group: 'Freigabe' },
  { key: 'status', label: 'Status', type: 'select', options: ANOMALY_STATUS, list: true, group: 'Freigabe' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Freigabe' },
];

export const swProblemFields: PlmField[] = [
  { key: 'problem_code', label: 'PR-ID', list: true, mono: true },
  dev,
  { key: 'title', label: 'Problem', list: true, required: true },
  { key: 'description', label: 'Beschreibung', type: 'textarea' },
  { key: 'source', label: 'Quelle', type: 'select', options: PROBLEM_SOURCES, list: true, group: 'Meldung' },
  { key: 'reported_by', label: 'Gemeldet von', group: 'Meldung' },
  { key: 'reported_at', label: 'Gemeldet am', type: 'date', list: true, group: 'Meldung' },
  { key: 'serial_number', label: 'Seriennummer', mono: true, group: 'Meldung' },
  { key: 'sw_version', label: 'Softwareversion', mono: true, list: true, group: 'Meldung' },
  { key: 'severity', label: 'Severity', type: 'select', options: BUG_SEVERITY, list: true, group: 'Bewertung' },
  { key: 'safety_relevant', label: 'Sicherheitsrelevant', type: 'boolean', list: true, group: 'Bewertung' },
  { key: 'vigilance_relevant', label: 'Meldepflichtig (MDR-Vigilanz)', type: 'boolean', list: true, group: 'Bewertung' },
  { key: 'investigation', label: 'Untersuchung', type: 'textarea', group: 'Bearbeitung' },
  { key: 'root_cause', label: 'Root Cause', type: 'textarea', group: 'Bearbeitung' },
  { key: 'correction', label: 'Korrektur', type: 'textarea', group: 'Bearbeitung' },
  { key: 'capa_id', label: 'CAPA', type: 'ref', refTable: 'capas', refLabel: 'title', refExtra: 'capa_number', list: true, group: 'Bearbeitung' },
  { key: 'bug_id', label: 'Bug', type: 'ref', refTable: 'plm_sw_bugs', refLabel: 'title', refExtra: 'bug_code', group: 'Bearbeitung' },
  { key: 'risk_id', label: 'Risiko', type: 'ref', refTable: 'plm_sw_risks', refLabel: 'hazard', refExtra: 'risk_code', group: 'Bearbeitung' },
  { key: 'effectiveness_check', label: 'Wirksamkeitsprüfung', type: 'textarea', group: 'Abschluss' },
  { key: 'closed_at', label: 'Geschlossen am', type: 'date', group: 'Abschluss' },
  { key: 'status', label: 'Status', type: 'select', options: PROBLEM_STATUS, list: true, group: 'Abschluss' },
];

export const swMeasureFields: PlmField[] = [
  { key: 'measure_code', label: 'MASS-ID', list: true, mono: true },
  dev,
  { key: 'risk_id', label: 'Risiko', type: 'ref', refTable: 'plm_sw_risks', refLabel: 'hazard', refExtra: 'risk_code', list: true },
  { key: 'title', label: 'Maßnahme', list: true, required: true },
  { key: 'measure_type', label: 'Maßnahmenart', type: 'select', options: MEASURE_TYPES, list: true },
  { key: 'description', label: 'Beschreibung', type: 'textarea' },
  { key: 'requirement_id', label: 'Umgesetzt als Requirement', type: 'ref', refTable: 'plm_sw_requirements', refLabel: 'title', refExtra: 'req_code', group: 'Umsetzung' },
  { key: 'test_id', label: 'Verifizierender Test', type: 'ref', refTable: 'plm_sw_tests', refLabel: 'title', refExtra: 'test_code', group: 'Umsetzung' },
  { key: 'implemented_in_version', label: 'Umgesetzt in Version', mono: true, group: 'Umsetzung' },
  { key: 'implemented_by', label: 'Umgesetzt von', group: 'Umsetzung' },
  { key: 'implemented_at', label: 'Umgesetzt am', type: 'date', group: 'Umsetzung' },
  { key: 'effectiveness_method', label: 'Methode der Wirksamkeitsprüfung', type: 'textarea', group: 'Wirksamkeit' },
  { key: 'effectiveness_result', label: 'Ergebnis (nur nach Durchführung)', type: 'textarea', group: 'Wirksamkeit' },
  { key: 'effectiveness_confirmed', label: 'Wirksamkeit bestätigt', type: 'boolean', list: true, group: 'Wirksamkeit' },
  { key: 'effectiveness_by', label: 'Geprüft von', group: 'Wirksamkeit' },
  { key: 'effectiveness_at', label: 'Geprüft am', type: 'date', group: 'Wirksamkeit' },
  { key: 'new_risk_introduced', label: 'Neues Risiko eingeführt', type: 'boolean', group: 'Wirksamkeit' },
  { key: 'status', label: 'Status', type: 'select', options: MEASURE_STATUS, list: true, group: 'Wirksamkeit' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Wirksamkeit' },
];

export const swClassificationFields: PlmField[] = [
  { key: 'title', label: 'Titel', list: true, required: true },
  dev,
  { key: 'product_safety_class', label: 'Software Safety Class (Produkt)', type: 'select', options: SAFETY_CLASSES, list: true },
  { key: 'mdr_class', label: 'MDR-Klasse', type: 'select', options: ['I', 'IIa', 'IIb', 'III'], list: true },
  { key: 'rationale', label: 'Begründung der Klassifizierung', type: 'textarea', group: 'Begründung' },
  { key: 'hazard_analysis_ref', label: 'Referenz Gefährdungsanalyse', group: 'Begründung' },
  { key: 'external_risk_control', label: 'Externe Risikobeherrschung (Hardware/Prozess)', type: 'textarea', group: 'Begründung' },
  { key: 'segregation_description', label: 'Segregation der Software-Einheiten', type: 'textarea', group: 'Begründung' },
  { key: 'standards', label: 'Angewandte Normen', type: 'textarea', group: 'Freigabe' },
  { key: 'valid_from', label: 'Gültig ab', type: 'date', group: 'Freigabe' },
  { key: 'status', label: 'Status', type: 'select', options: PLAN_STATUS, list: true, group: 'Freigabe' },
  { key: 'approved_by', label: 'Freigegeben von', group: 'Freigabe' },
  { key: 'approved_at', label: 'Freigegeben am', type: 'date', group: 'Freigabe' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Freigabe' },
];

export const swSignatureFields: PlmField[] = [
  { key: 'entity_table', label: 'Dokument / Datensatzart', list: true, required: true },
  dev,
  { key: 'entity_label', label: 'Bezeichnung (z. B. SRS v1.2)', list: true },
  { key: 'meaning', label: 'Bedeutung der Unterschrift', type: 'select', options: SIGN_MEANINGS, list: true },
  { key: 'signer_name', label: 'Unterzeichner', list: true, required: true },
  { key: 'signer_role', label: 'Rolle / Funktion', list: true },
  { key: 'statement', label: 'Erklärung', type: 'textarea', group: 'Nachweis' },
  { key: 'document_hash', label: 'Dokument-Hash', mono: true, group: 'Nachweis' },
  { key: 'status', label: 'Status', type: 'select', options: ['gueltig', 'widerrufen'], list: true, group: 'Nachweis' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Nachweis' },
];
