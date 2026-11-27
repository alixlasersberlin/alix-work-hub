import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { externalHost, groupByUrl, objectKey } from "./refs.ts";

Deno.test("only allowlisted https hosts count as external", () => {
  assertEquals(externalHost("https://alix-lasers.de/a.pdf"), "alix-lasers.de");
  assertEquals(externalHost("http://alix-lasers.de/a.pdf"), null);
  assertEquals(externalHost("https://evil.example/a.png"), null);
  assertEquals(externalHost("https://xmrmkgfgpoundfwhnxfs.supabase.co/x"), null);
  assertEquals(externalHost(null), null);
});
Deno.test("same URL referenced twice is stored once", () => {
  const g = groupByUrl([
    { table: "ph_media", id: "1", field: "url", url: "https://framerusercontent.com/i.png" },
    { table: "ph_products", id: "2", field: "hero_image_url", url: "https://framerusercontent.com/i.png " },
    { table: "ph_media", id: "3", field: "url", url: "https://other.example/x" },
  ]);
  assertEquals(g.size, 1);
  assertEquals(g.get("https://framerusercontent.com/i.png")!.length, 2);
});
Deno.test("content-addressed key", () => {
  assertEquals(objectKey("abcdef"), "external-media/objects/ab/abcdef");
});
