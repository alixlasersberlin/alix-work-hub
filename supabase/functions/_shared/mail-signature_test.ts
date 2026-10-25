import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { appendSignature } from "./mail-signature.ts";

Deno.test("reiner Text bleibt im sichtbaren HTML-Teil der Mail erhalten", () => {
  const { html } = appendSignature("", "Hallo Frau Eitner,\nIhr Auftrag <AB-1>", "Lars Scheidler");
  assertStringIncludes(html, "Hallo Frau Eitner,");
  assertStringIncludes(html, "Ihr Auftrag &lt;AB-1&gt;");
  assert(html.indexOf("Hallo") < html.indexOf("alix-signature-v1"));
});
