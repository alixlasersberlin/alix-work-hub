// Stable public origin for embeddable scripts (connect.js).
// Preview-/Sandbox-Domains sind login-geschützt und können nicht auf Kundenseiten
// eingebunden werden – daher immer die öffentliche Produktions-Domain verwenden.
export const PUBLIC_EMBED_ORIGIN = "https://alixwork.de";

export function getEmbedOrigin(): string {
  if (typeof window === "undefined") return PUBLIC_EMBED_ORIGIN;
  const host = window.location.hostname;
  const isPreview =
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") ||
    host === "localhost" ||
    host === "127.0.0.1";
  return isPreview ? PUBLIC_EMBED_ORIGIN : window.location.origin;
}

export function buildEmbedSnippet(apiKey: string): string {
  return `<script async src="${getEmbedOrigin()}/connect.js" data-key="${apiKey}"></script>`;
}
