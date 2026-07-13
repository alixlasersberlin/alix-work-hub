import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "lovable:chunk-reload";

/**
 * Wraps React.lazy with automatic reload on stale-chunk errors.
 * After a redeploy, previously cached HTML references old JS chunk hashes
 * that no longer exist ("Failed to fetch dynamically imported module").
 * We reload once to pick up the new index.html + fresh chunk hashes.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isChunkError =
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /error loading dynamically imported module/i.test(msg);

      if (isChunkError && typeof window !== "undefined") {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
        if (!alreadyReloaded) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          // Return a never-resolving promise while the page reloads.
          return new Promise(() => {}) as any;
        }
      }
      throw err;
    }
  });
}

// Clear the reload guard once the app has successfully loaded.
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    sessionStorage.removeItem(RELOAD_KEY);
  });
}
