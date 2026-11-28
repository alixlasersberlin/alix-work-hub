import { blockedMaintenanceEndpoint } from "../_shared/blocked-maintenance-endpoint.ts";

// Approved A0 containment: never restore the former privileged maintenance handler.
Deno.serve(blockedMaintenanceEndpoint);
