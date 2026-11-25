/** Decode the URL segment once; stored hub identities must remain unchanged. */
export function productRoute(pathname: string): { productId?: string; sub?: string } {
  const parts = pathname.split("/").filter(Boolean);
  const index = parts.indexOf("products");
  const segment = index >= 0 ? parts[index + 1] : undefined;
  return {
    productId: segment === undefined ? undefined : decodeURIComponent(segment),
    sub: index >= 0 ? parts[index + 2] : undefined,
  };
}