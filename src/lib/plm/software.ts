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
