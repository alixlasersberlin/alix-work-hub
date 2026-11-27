import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { confirms, dedupKey, isStale, nextRetryDelay, sign, verify } from "./ph-signal.ts";
const S = "test-secret-only", now = 1_800_000_000, body = '{"a":1}';

Deno.test("gültige Signatur", async () => assertEquals(await verify(S, String(now), await sign(S, now, body), body, now), { ok: true }));
Deno.test("manipulierter Body abgelehnt", async () =>
  assertEquals((await verify(S, String(now), await sign(S, now, body), '{"a":2}', now)), { ok: false, reason: "bad_signature" }));
Deno.test("falsches Geheimnis abgelehnt", async () =>
  assertEquals((await verify(S, String(now), await sign("other", now, body), body, now)).ok, false));
Deno.test("abgelaufenes Signal abgelehnt", async () =>
  assertEquals(await verify(S, String(now - 301), await sign(S, now - 301, body), body, now), { ok: false, reason: "expired" }));
Deno.test("fehlende Header abgelehnt", async () => assertEquals((await verify(S, null, null, body, now)).ok, false));
Deno.test("doppelte Ereignisse → gleicher Schlüssel", async () => {
  const e = { channel: "de", product_id: "T-1", version: "2026-11-27T06:00:00Z", desired: "ONLINE" as const };
  assertEquals(await dedupKey(e), await dedupKey({ ...e }));
  assertNotEquals(await dedupKey(e), await dedupKey({ ...e, desired: "OFFLINE" }));
});
Deno.test("veraltete Ereignisse erkannt", () => {
  assert(isStale("2026-11-27T06:00:00Z", "2026-11-27T06:00:01Z"));
  assert(!isStale("2026-11-27T06:00:02Z", "2026-11-27T06:00:01Z"));
  assert(!isStale("2026-11-27T06:00:00Z", null));
  assert(isStale("kaputt", "2026-11-27T06:00:00Z"));
});
Deno.test("schnelles AN/AUS: nur neueste Version gewinnt", () => {
  const versions = ["2026-11-27T06:00:00.100Z", "2026-11-27T06:00:00.300Z", "2026-11-27T06:00:00.200Z"];
  let latest: string | null = null; const applied: string[] = [];
  for (const v of versions) if (!isStale(v, latest)) { latest = v; applied.push(v); }
  assertEquals(applied, versions.slice(0, 2));
});
Deno.test("Verbindungsfehler: begrenzte Wiederholungen", () => {
  assertEquals([0, 1, 2, 3, 4].map(nextRetryDelay), [2000, 10000, 30000, 120000, 600000]);
  assertEquals(nextRetryDelay(5), null);
});
Deno.test("Empfang ist kein Nachweis – nur passende Rückmeldung bestätigt", () => {
  const s = { version: "v2", desired: "OFFLINE" as const };
  assert(confirms(s, { version: "v2", state: "OFFLINE" }));
  assert(!confirms(s, { version: "v1", state: "OFFLINE" }));
  assert(!confirms(s, { version: "v2", state: "ERROR" }));
});
