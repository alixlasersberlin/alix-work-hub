// PRODUCT HUB 2.0 – single publication decision (pure, no I/O).
// Used by shadow signalling now; product-hub-api will switch to it after approval.
export const SIGNAL_CHANNELS = ["de", "com", "dubai"] as const;
export type SignalChannel = typeof SIGNAL_CHANNELS[number];

const ALIASES: Record<string, string> = {
  de: "de", "alix-lasers.de": "de",
  com: "com", "alix-lasers.com": "com", global: "com",
  dubai: "dubai", ae: "dubai", uae: "dubai", "alix-lasers.ae": "dubai",
  at: "at", beautyco: "beautyco", beauty: "beautyco",
  usa: "usa", us: "usa",
};
/** Maps legacy spellings (Dubai, AE, UAE …) to the permanent channel id; null if unknown. */
export function normalizeChannel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return ALIASES[raw.trim().toLowerCase()] ?? null;
}

export const ACTIVE_COLUMN: Record<string, string> = {
  de: "active_de", com: "active_com", dubai: "active_dubai", at: "active_at", usa: "active_usa",
};
export const EXCLUDED_CHANNELS = new Set(["usa"]);

export type ProductInput = {
  status?: string | null; name?: string | null; slug?: string | null; alix_product_id?: string | null;
  hero_image_url?: string | null; [k: string]: unknown;
};
export type ChannelInput = { hold?: boolean | null; status?: string | null } | null;

export type Decision = { channel: string; desired: "ONLINE" | "OFFLINE"; reasons: string[] };

const SIGNED_PARAMS = ["token", "x-amz-signature", "x-amz-credential", "signature", "sig", "expires"];
/** Public = https, no credentials, not a signed/expiring storage link. Harmless resize params (?width=) are allowed. */
export function isPublicImage(url: unknown): boolean {
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    if (u.username || u.password || /\/object\/(sign|authenticated)\//.test(u.pathname)) return false;
    return ![...u.searchParams.keys()].some(k => SIGNED_PARAMS.includes(k.toLowerCase()));
  } catch { return false; }
}

/** Storage path of a signed product-hub-docs image belonging to the product, else null (no other buckets/paths). */
export function webImagePath(url: unknown, productId: string): string | null {
  if (typeof url !== "string") return null;
  try {
    const m = new URL(url).pathname.match(/\/storage\/v1\/object\/sign\/product-hub-docs\/(images\/[^?]+)$/);
    const path = m ? decodeURIComponent(m[1]) : null;
    return path && path.startsWith(`images/${productId}/`) && !path.includes("..") && /\.(jpe?g|png|webp|avif)$/i.test(path) ? path : null;
  } catch { return null; }
}

/** AN/AUS is binding unless a regulatory hold, exclusion or missing required data blocks it. */
export function decidePublication(p: ProductInput, rawChannel: string, ch: ChannelInput = null): Decision {
  const channel = normalizeChannel(rawChannel) ?? rawChannel;
  const reasons: string[] = [];
  if (EXCLUDED_CHANNELS.has(channel)) reasons.push("channel_excluded");
  if (p.status !== "published") reasons.push("product_not_published");
  const col = ACTIVE_COLUMN[channel];
  const switchOn = col ? p[col] === true : ch != null && ch.status !== "inactive";
  if (!switchOn) reasons.push("switch_off");
  if (ch?.hold === true) reasons.push("regulatory_hold");
  if (!p.alix_product_id) reasons.push("missing_product_id");
  if (!p.name?.trim()) reasons.push("missing_name");
  if (!p.slug?.trim()) reasons.push("missing_slug");
  if (switchOn && !isPublicImage(p.hero_image_url)) reasons.push("missing_public_image");
  return { channel, desired: reasons.length ? "OFFLINE" : "ONLINE", reasons };
}

/** What the current live API decides (status + switch only) – to report divergences. */
export function legacyDecision(p: ProductInput, channel: string): "ONLINE" | "OFFLINE" {
  const col = ACTIVE_COLUMN[channel];
  return p.status === "published" && col && p[col] === true ? "ONLINE" : "OFFLINE";
}
