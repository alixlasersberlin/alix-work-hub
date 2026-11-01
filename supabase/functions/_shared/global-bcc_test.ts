import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applySystemCopies } from "./global-bcc.ts";

Deno.test("Mahnung: gesperrte Service-Kopie wird entfernt, kein Archiv-BCC", () => {
  const p: any = { to: ["kunde@example.org"], subject: "Freundliche Zahlungserinnerung – Anzahlung AB-1", bcc: ["service@alix-lasers.com"] };
  applySystemCopies(p);
  assertEquals(p.bcc, undefined);
});

Deno.test("Normale Mail: nur Archiv-BCC, gesperrte Buchhaltungs-/Service-Adressen entfernt", () => {
  const p: any = { to: ["kunde@example.org"], subject: "Lieferung", cc: ["buchhaltung@alix-lasers.com"], bcc: ["service@alix-lasers.com", "k.trinh@alix-operation.de"] };
  applySystemCopies(p);
  assertEquals(p.cc, undefined);
  assertEquals(p.bcc, ["k.trinh@alix-operation.de", "rde@alix-lasers.com"]);
});
