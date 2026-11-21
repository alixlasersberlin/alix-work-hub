import { describe, expect, it } from 'vitest';
import { deactivatedGlobalChannels, isChannelDeactivation } from './deactivation';

describe('automatische Webseitenabschaltung', () => {
  it('sendet bei COM-Abwahl nur COM', () => {
    expect(deactivatedGlobalChannels({ active_com: true, active_de: true }, { active_com: false })).toEqual(['com']);
  });
  it('sendet bei DE-Abwahl nur DE', () => {
    expect(deactivatedGlobalChannels({ active_de: true }, { active_de: false })).toEqual(['de']);
  });
  it('deaktiviert keine bereits inaktiven Artikel durch allgemeines Speichern', () => {
    expect(deactivatedGlobalChannels({ active_com: false }, { active_com: false })).toEqual([]);
  });
  it('sendet weder Aktivierungen noch US-Änderungen als Abschaltung', () => {
    expect(deactivatedGlobalChannels({ active_usa: true, active_com: false }, { active_usa: false, active_com: true })).toEqual([]);
  });
  it('Zurückhalten und inactive lösen Abschaltung aus', () => {
    expect(isChannelDeactivation({ hold: true })).toBe(true);
    expect(isChannelDeactivation({ status: 'inactive' })).toBe(true);
    expect(isChannelDeactivation({ hold: false, status: 'published' })).toBe(false);
  });
});