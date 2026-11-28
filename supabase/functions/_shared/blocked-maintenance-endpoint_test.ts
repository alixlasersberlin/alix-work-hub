import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { blockedMaintenanceEndpoint } from "./blocked-maintenance-endpoint.ts";

for (const endpoint of ["admin-reset-jerry", "tmp-create-sobitsch"]) {
  Deno.test(`A0 maintenance ${endpoint}: every execution request denied for all credential classes`, async () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]) {
      for (const authorization of ["", "invalid", "Bearer synthetic-user", "Bearer synthetic-admin", "Bearer synthetic-machine"]) {
        const response = blockedMaintenanceEndpoint(new Request(`https://example.test/${endpoint}`, { method, headers: { authorization } }));
        assertEquals(response.status, 410);
        assertEquals((await response.json()).code, "A0_ENDPOINT_BLOCKED");
      }
    }
  });
  Deno.test(`A0 maintenance ${endpoint}: never parses attacker-supplied payload`, () => {
    const request = new Request(`https://example.test/${endpoint}`, { method: "POST", body: "malformed-json" });
    let reads = 0;
    request.json = () => { reads++; throw new Error("Body must not be read"); };
    assertEquals(blockedMaintenanceEndpoint(request).status, 410);
    assertEquals(reads, 0);
    assertEquals(request.bodyUsed, false);
  });
  Deno.test(`A0 maintenance ${endpoint}: preflight remains side-effect-free`, () => {
    const response = blockedMaintenanceEndpoint(new Request(`https://example.test/${endpoint}`, { method: "OPTIONS" }));
    assertEquals(response.status, 204);
    assertEquals(response.body, null);
  });
}
