import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { productRoute } from "./product-route.ts";

for (const channel of ["de", "com"]) {
  Deno.test(`BlueIce ${channel}: list identity resolves unchanged on detail route`, () => {
    const identity = "Alix BlueIce Smart KI";
    const url = new URL(`https://example.test/product-hub-api/products/${encodeURIComponent(identity)}?channel=${channel}`);
    assertEquals(productRoute(url.pathname).productId, identity);
  });
}

Deno.test("media and documents use the same decoded identity", () => {
  for (const sub of ["media", "documents", "content"]) {
    assertEquals(productRoute(`/product-hub-api/products/Alix%20BlueIce%20Smart%20KI/${sub}`), {
      productId: "Alix BlueIce Smart KI", sub,
    });
  }
});

Deno.test("UUID identities and list routes remain unchanged", () => {
  const id = "dcb978ce-6b71-45c6-8da8-3ede23111b99";
  assertEquals(productRoute(`/product-hub-api/products/${id}`).productId, id);
  assertEquals(productRoute("/product-hub-api/products").productId, undefined);
});

Deno.test("identity is decoded only once, without interpreting plus as space", () => {
  assertEquals(productRoute("/products/Name%2520Plus%2B").productId, "Name%20Plus+");
});

Deno.test("malformed percent encoding is rejected", () => {
  assertThrows(() => productRoute("/products/Alix%ZZ"), URIError);
});