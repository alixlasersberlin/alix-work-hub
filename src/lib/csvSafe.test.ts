import { describe, expect, it } from 'vitest';
import { csvCell, csvQuoted, neutralizeFormula } from './csvSafe';

describe('csvSafe', () => {
  it('neutralises spreadsheet formulas from untrusted answers', () => {
    expect(neutralizeFormula('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(neutralizeFormula('+49 170')).toBe(`'+49 170`);
    expect(neutralizeFormula('@SUM(1)')).toBe(`'@SUM(1)`);
    expect(neutralizeFormula('Max Muster')).toBe('Max Muster');
  });
  it('quotes delimiters and neutralised cells', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('=1+1')).toBe(`"'=1+1"`);
    expect(csvCell(null)).toBe('');
    expect(csvQuoted('-2')).toBe(`"'-2"`);
  });
});
