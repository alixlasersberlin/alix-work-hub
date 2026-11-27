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

import { isPublicImage as isPub2, webImagePath as wip } from "./ph-publication.ts";
Deno.test("public images allow resize params but reject signed links", () => {
  const a = (c: boolean) => { if (!c) throw new Error("assert"); };
  a(isPub2("https://framerusercontent.com/images/x.jpg?width=1202&height=1200"));
  a(!isPub2("https://x.supabase.co/storage/v1/object/sign/product-hub-docs/images/p/a.jpg?token=abc"));
  a(!isPub2("https://cdn.example.com/a.jpg?X-Amz-Signature=1"));
  a(!isPub2("http://cdn.example.com/a.jpg"));
});
Deno.test("web image path only for own product images in product-hub-docs", () => {
  const a = (c: boolean) => { if (!c) throw new Error("assert"); };
  const u = "https://x.supabase.co/storage/v1/object/sign/product-hub-docs/images/P1/1-nexus1.jpg?token=t";
  a(wip(u, "P1") === "images/P1/1-nexus1.jpg");
  a(wip(u, "P2") === null);
  a(wip("https://x.supabase.co/storage/v1/object/sign/product-hub-docs/docs/P1/a.pdf?token=t", "P1") === null);
  a(wip("https://x.supabase.co/storage/v1/object/sign/production-orders/images/P1/a.jpg?token=t", "P1") === null);
});
