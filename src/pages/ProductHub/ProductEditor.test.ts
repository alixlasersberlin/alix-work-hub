import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Exercise the actual editor handler without loading its authenticated data dependencies.
const source = readFileSync(`${process.cwd()}/src/pages/ProductHub/ProductEditor.tsx`, 'utf8');
const handler = source.match(/onChange=\{e => (set\('features', [^\n]+)\} \/>/)?.[1];
if (!handler) throw new Error('Equipment list change handler not found');
const changeFeatures = new Function('e', 'set', handler) as (
  event: { target: { value: string } },
  set: (key: string, value: string[]) => void,
) => void;

function edit(value: string) {
  let features: string[] = [];
  changeFeatures({ target: { value } }, (_key, next) => { features = next; });
  return features;
}

describe('equipment list editing', () => {
  it('preserves an empty line inserted between existing features', () => {
    expect(edit('a\nb\n\nc')).toEqual(['a', 'b', '', 'c']);
    expect(edit('a\nb\nnew feature\nc')).toEqual(['a', 'b', 'new feature', 'c']);
  });

  it('preserves leading spaces and trailing newlines while typing', () => {
    expect(edit('a\n  b\nc\n')).toEqual(['a', '  b', 'c', '']);
  });
});