import { describe, expect, it, vi } from 'vitest';
import { loadOrdersProgressively } from './orders-progressive-load';

describe('progressive order reads', () => {
  it('reads the complete history once, enriching each page before reading the next', async () => {
    const source = Array.from({ length: 1135 }, (_, id) => ({ id }));
    const received: typeof source = [];
    const fetchPage = vi.fn(async (from: number, to: number) => {
      expect(received.length).toBe(from);
      expect(to - from + 1).toBeLessThanOrEqual(100);
      return { data: source.slice(from, to + 1), error: null };
    });
    await loadOrdersProgressively(fetchPage, rows => { received.push(...rows); }, () => true);
    expect(received).toEqual(source);
    expect(fetchPage.mock.calls[0]).toEqual([0, 49]);
    expect(fetchPage.mock.calls[1]).toEqual([50, 149]);
  });
  it('retries a timeout with a smaller batch without skipping rows', async () => {
    const source = Array.from({ length: 60 }, (_, id) => id);
    const received: number[] = [];
    const fetchPage = vi.fn(async (from: number, to: number) => to - from >= 49
      ? { data: null, error: { code: '57014', message: 'statement timeout' } }
      : { data: source.slice(from, to + 1), error: null });
    await loadOrdersProgressively(fetchPage, rows => { received.push(...rows); }, () => true);
    expect(fetchPage.mock.calls[1]).toEqual([0, 24]);
    expect(received).toEqual(source);
  });
  it('does not retry a permission error or treat it as an empty page', async () => {
    const fetchPage = vi.fn(async () => ({ data: null, error: { code: '42501', message: 'Zugriff verweigert' } }));
    await expect(loadOrdersProgressively(fetchPage, () => {}, () => true)).rejects.toThrow('Zugriff verweigert');
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
  it('ignores an obsolete response and stops issuing requests', async () => {
    let active = true;
    const receive = vi.fn();
    const fetchPage = vi.fn(async () => { active = false; return { data: [1], error: null }; });
    await loadOrdersProgressively(fetchPage, receive, () => active);
    expect(receive).not.toHaveBeenCalled();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});