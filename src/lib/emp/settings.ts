const KEY = 'emp:settings:v1';

export interface EmpSettings {
  darkMode: boolean;
  language: 'de' | 'en';
  pushEnabled: boolean;
  offlineEnabled: boolean;
  biometricLock: boolean;
  homeStart: 'home' | 'calendar' | 'tasks';
  qrEnabled: boolean;
  signaturesEnabled: boolean;
  photosEnabled: boolean;
}

const DEFAULTS: EmpSettings = {
  darkMode: true,
  language: 'de',
  pushEnabled: false,
  offlineEnabled: true,
  biometricLock: false,
  homeStart: 'home',
  qrEnabled: true,
  signaturesEnabled: true,
  photosEnabled: true,
};

export function getEmpSettings(): EmpSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return DEFAULTS; }
}
export function setEmpSettings(patch: Partial<EmpSettings>) {
  const next = { ...getEmpSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
