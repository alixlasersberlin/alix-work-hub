/** Move a complete position without changing its contents or mutating the source. */
export function moveLine<T extends { id: string }>(
  lines: T[],
  id: string,
  direction: -1 | 1,
): T[] {
  const from = lines.findIndex(line => line.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= lines.length) return lines;
  const next = [...lines];
  const [line] = next.splice(from, 1);
  if (!line) return lines;
  next.splice(to, 0, line);
  return next;
}