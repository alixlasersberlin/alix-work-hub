import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { forChannel, groupBy, syncAllowed, syncScope } from "./bundle.ts";

const APEX = "e32852b4-0148-4e72-9930-271d70b0dc68";
const OTHER = "88f875aa-5b67-471a-a226-ff46ca4aec41";
const pilot = (ch: string) => ({ emergency_stopped: false, revision: 1, channels: { [ch]: { mode: "pilot" as const, pilot_product_id: APEX } } });

for (const ch of ["de", "com"]) {
  Deno.test(`${ch}: pilot allows only Apex to sync`, () => {
    assertEquals(syncAllowed(pilot(ch), ch, APEX), true);
    assertEquals(syncAllowed(pilot(ch), ch, OTHER), false);
    assertEquals(syncScope(pilot(ch), ch, "Apex"), { governed: true, mode: "pilot", emergency_stopped: false, pilot_product_id: "Apex" });
  });
  Deno.test(`${ch}: emergency stop and missing gate block every sync`, () => {
    assertEquals(syncAllowed({ ...pilot(ch), emergency_stopped: true }, ch, APEX), false);
    assertEquals(syncAllowed(null, ch, APEX), false);
    assertEquals(syncScope(null, ch, "Apex").governed && (syncScope(null, ch, "Apex") as any).mode, "blocked");
  });
}

Deno.test("DE pilot does not open COM", () => {
  assertEquals(syncAllowed(pilot("de"), "com", APEX), false);
});

Deno.test("non-governed channels keep legacy behaviour", () => {
  assertEquals(syncAllowed(pilot("de"), "dubai", APEX), null);
  assertEquals(syncScope(pilot("de"), "at", null), { governed: false });
});

Deno.test("channel filter and grouping match existing subroutes", () => {
  const rows = [{ product_id: "a", channels: [] }, { product_id: "a", channels: ["com"] }, { product_id: "b", channels: ["de"] }];
  assertEquals(forChannel(rows, "de").length, 2);
  assertEquals(Object.keys(groupBy(forChannel(rows, "com"), "product_id")), ["a"]);
});
