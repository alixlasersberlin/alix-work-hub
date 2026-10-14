import { describe, it, expect } from 'vitest';
import { splitGross, remainingCreditable } from './creditNote';

describe('Gutschrift-Regeln', () => {
  it('teilt 119 € brutto bei 19 % in 100 netto und 19 Steuer', () => {
    expect(splitGross(119, 19)).toEqual({ gross: 119, net: 100, vat: 19 });
  });
  it('erlaubt nicht mehr als den Restbetrag der Rechnung', () => {
    expect(remainingCreditable(1000, 400)).toBe(600);
    expect(remainingCreditable(1000, 1200)).toBe(0);
  });
});
