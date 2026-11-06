import { describe, expect, it } from 'vitest';
import { moveLine } from './reorder-lines';

describe('position order', () => {
  const lines = [
    { id: 'device', rate: 16900, quantity: 1, description: 'Gerät', device_color: 'Gold' },
    { id: 'training', rate: 400, quantity: 2, description: 'Schulung', device_color: null },
    { id: 'media', rate: 0, quantity: 1, description: 'Mediapaket', device_color: null },
  ];

  it('moves a position up with its complete contents', () => {
    const result = moveLine(lines, 'training', -1);
    expect(result.map(line => line.id)).toEqual(['training', 'device', 'media']);
    expect(result[0]).toBe(lines[1]);
    expect(result[1]).toBe(lines[0]);
    expect(lines.map(line => line.id)).toEqual(['device', 'training', 'media']);
  });

  it('moves a position down without changing prices or quantities', () => {
    const result = moveLine(lines, 'device', 1);
    expect(result.map(line => line.id)).toEqual(['training', 'device', 'media']);
    expect(result.reduce((sum, line) => sum + line.rate * line.quantity, 0)).toBe(17700);
    expect(result[1]).toEqual(lines[0]);
  });

  it('does not move beyond either end or create missing positions', () => {
    expect(moveLine(lines, 'device', -1)).toBe(lines);
    expect(moveLine(lines, 'media', 1)).toBe(lines);
    expect(moveLine(lines, 'missing', 1)).toBe(lines);
    expect(moveLine([], 'missing', -1)).toEqual([]);
    expect(moveLine([lines[0]], 'device', 1)).toEqual([lines[0]]);
  });

  it('preserves the new order when serialized for saving and reopening', () => {
    const result = moveLine(moveLine(lines, 'media', -1), 'media', -1);
    expect(JSON.parse(JSON.stringify({ lines: result })).lines).toEqual([
      lines[2], lines[0], lines[1],
    ]);
  });
});