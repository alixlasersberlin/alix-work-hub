import { describe, it, expect } from 'vitest';
import { isMediaPaketTicket } from './ticketKind';

describe('isMediaPaketTicket', () => {
  it('erkennt Mediapaket im Titel', () => expect(isMediaPaketTicket({ title: 'Mediapaket' })).toBe(true));
  it('erkennt Media-Paket im Betreff', () => expect(isMediaPaketTicket({ subject: 'AW: Ihr Media-Paket' })).toBe(true));
  it('erkennt Kategorie Media Paket', () => expect(isMediaPaketTicket({ category: 'Media Paket' })).toBe(true));
  it('normale Serviceanfrage nicht', () => expect(isMediaPaketTicket({ title: 'Laser defekt', category: 'Reparatur' })).toBe(false));
});
