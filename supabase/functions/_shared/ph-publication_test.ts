import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decidePublication, legacyDecision, normalizeChannel } from "./ph-publication.ts";
const base = { status: "published", name: "Testgerät", slug: "test", alix_product_id: "T-1",
  hero_image_url: "https://example.test/i.png", active_de: true, active_com: false, active_dubai: true };

Deno.test("Veröffentlichung: AN + vollständige Daten → ONLINE", () => assertEquals(decidePublication(base, "de").desired, "ONLINE"));
Deno.test("Deaktivierung: AUS → OFFLINE", () => assertEquals(decidePublication(base, "com").reasons, ["switch_off"]));
Deno.test("Nicht veröffentlichtes Produkt → OFFLINE", () => assertEquals(decidePublication({ ...base, status: "draft" }, "de").desired, "OFFLINE"));
Deno.test("Regulatorische Sperre gewinnt gegen AN", () => assertEquals(decidePublication(base, "de", { hold: true }).reasons, ["regulatory_hold"]));
Deno.test("Privater signierter Bildlink blockiert", () =>
  assertEquals(decidePublication({ ...base, hero_image_url: "https://x.supabase.co/storage/v1/object/sign/a.png?token=1" }, "de").reasons, ["missing_public_image"]));
Deno.test("USA bleibt ausgeschlossen", () => assertEquals(decidePublication({ ...base, active_usa: true }, "usa").desired, "OFFLINE"));
Deno.test("Mehrere Webseiten unabhängig", () => {
  assertEquals(["de", "com", "dubai"].map((c) => decidePublication(base, c).desired), ["ONLINE", "OFFLINE", "ONLINE"]);
});
Deno.test("Schreibweisen Dubai/AE/UAE → dubai", () => {
  assertEquals(["Dubai", "ae", "UAE", "alix-lasers.ae"].map(normalizeChannel), ["dubai", "dubai", "dubai", "dubai"]);
  assertEquals(normalizeChannel("xyz"), null);
  assertEquals(decidePublication(base, "Dubai").channel, "dubai");
});
Deno.test("Abweichung zur Live-Logik wird erkannt", () => {
  const p = { ...base, hero_image_url: null };
  assertEquals([legacyDecision(p, "de"), decidePublication(p, "de").desired], ["ONLINE", "OFFLINE"]);
});
