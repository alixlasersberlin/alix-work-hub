import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  PH_PRODUCT_FIELDS, applyPriceRule, catalogMoney, defaultCover, defaultSettings, hubPrices,
  type PhCatalogCover, type PhCatalogSettings, PH_PRICE_KINDS,
} from '@/lib/producthub/catalog';

export interface CatalogRenderProps {
  catalog: any;
  items: any[];
  products: any[];
  pages: any[];
  device?: 'desktop' | 'tablet' | 'mobile' | 'pdf';
  publicUrl?: string;
}

function useQr(value?: string) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    if (!value) { setSrc(''); return; }
    QRCode.toDataURL(value, { margin: 0, width: 240 }).then(setSrc).catch(() => setSrc(''));
  }, [value]);
  return src;
}

/** Alle im Katalog darzustellenden Preise eines Geräts (Master bleibt unverändert). */
export function itemPrices(catalog: any, item: any, product: any) {
  const s: PhCatalogSettings = { ...defaultSettings(), ...(catalog.settings || {}) };
  const h = hubPrices(product, catalog.country);
  const out: { key: string; label: string; value: string; display: string; raw: number }[] = [];
  const money = (n: number) => catalogMoney(n, catalog.country, catalog.currency, s.vatMode, h.inputMode);

  for (const kind of s.priceKinds || []) {
    const override = item?.prices?.[kind];
    let raw = 0;
    if (override !== undefined && override !== null && override !== '') raw = Number(override);
    else if (kind === 'uvp') raw = h.uvp;
    else if (kind === 'vk') raw = applyPriceRule(h.vk, s.priceRule);
    else if (kind === 'rent') raw = h.rent;
    else if (kind === 'deposit') raw = h.deposit;
    const display = s.priceDisplay?.[kind] || 'show';
    if (display === 'hidden') continue;
    if (!raw && display !== 'request') continue;
    const label = PH_PRICE_KINDS.find(p => p.key === kind)?.label || kind;
    const suffix = kind === 'rent' || kind === 'leasing' || kind === 'installment' ? ' / Monat' : '';
    out.push({
      key: kind, label, raw, display,
      value: display === 'request' ? 'Preis auf Anfrage' : `${display === 'from' ? 'ab ' : ''}${money(raw)}${suffix}`,
    });
  }
  return { list: out, settings: s, hub: h };
}

function Price({ p }: { p: { label: string; value: string; display: string } }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] uppercase tracking-wide opacity-60 w-28 shrink-0">{p.label}</span>
      <span className={`font-semibold ${p.display === 'strike' ? 'line-through opacity-60' : ''}`}>{p.value}</span>
    </div>
  );
}

function productImage(item: any, product: any) {
  if (item?.image_mode === 'custom' && item.image_url) return item.image_url;
  return product?.hero_image_url || null;
}

function Page({ children, style, className = '' }: any) {
  return (
    <div
      className={`ph-cat-page relative overflow-hidden rounded-lg shadow-lg mx-auto mb-6 ${className}`}
      style={{ aspectRatio: '210 / 297', width: '100%', ...style }}
    >{children}</div>
  );
}

export function CatalogCover({ catalog, publicUrl }: { catalog: any; publicUrl?: string }) {
  const c: PhCatalogCover = { ...defaultCover(), ...(catalog.cover || {}) };
  const qr = useQr(c.qr && publicUrl ? publicUrl : undefined);
  return (
    <Page style={{ background: c.bg, color: c.color }}>
      {c.image && (
        <img
          src={c.image} alt="Katalog Titelbild"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: c.imagePosition === 'contain' ? 'contain' : 'cover' }}
        />
      )}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(c.overlay ?? 45) / 100})` }} />
      <div
        className="absolute inset-0 flex flex-col justify-end p-[6%] gap-3"
        style={{ textAlign: c.align as any, alignItems: c.align === 'center' ? 'center' : c.align === 'right' ? 'flex-end' : 'flex-start' }}
      >
        {c.title && <div style={{ fontSize: `${(c.fontSize || 56) / 16}rem`, lineHeight: 1.05 }} className="font-bold tracking-tight">{c.title}</div>}
        {c.subtitle && <div className="text-xl md:text-2xl font-medium opacity-90 whitespace-pre-line">{c.subtitle}</div>}
        {c.claim && <div className="text-sm md:text-base opacity-80 max-w-[70%] whitespace-pre-line">{c.claim}</div>}
        {c.promoNote && <div className="text-sm font-semibold px-3 py-1 rounded" style={{ background: catalog.settings?.theme?.accent || '#c9a227', color: '#000' }}>{c.promoNote}</div>}
        {c.validity && <div className="text-xs opacity-70">{c.validity}</div>}
        {c.button && <div className="text-xs px-4 py-2 rounded-full border border-current inline-block">{c.button}</div>}
        {qr && <img src={qr} alt="QR-Code zum Online-Katalog" className="w-24 h-24 bg-white p-1 rounded" />}
      </div>
    </Page>
  );
}

function Header({ catalog }: { catalog: any }) {
  const s: PhCatalogSettings = { ...defaultSettings(), ...(catalog.settings || {}) };
  if (!s.header?.enabled) return null;
  return (
    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest opacity-70 px-[6%] pt-[4%]">
      <span>{s.header.logo ? 'ALIX LASERS' : ''}</span>
      <span>{s.header.title || catalog.name}</span>
      <span>{s.header.website}</span>
    </div>
  );
}

function Footer({ catalog, page }: { catalog: any; page?: number }) {
  const s: PhCatalogSettings = { ...defaultSettings(), ...(catalog.settings || {}) };
  if (!s.footer?.enabled) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 px-[6%] pb-[3%] text-[9px] opacity-60 space-y-1">
      <div className="border-t border-current/20 pt-2 flex justify-between gap-3">
        <span>{[s.footer.company, s.footer.address, s.footer.phone, s.footer.email, s.footer.website].filter(Boolean).join(' · ')}</span>
        {s.footer.pageNumbers && page ? <span>{page}</span> : null}
      </div>
      <div className="leading-snug">{s.legal}</div>
    </div>
  );
}

export function CatalogProductPage({ catalog, item, product, publicUrl, page }: any) {
  const { list, settings } = itemPrices(catalog, item, product);
  const fields = { ...(settings.fields || {}), ...(item.fields || {}) };
  const layout = item.layout || settings.layout || 'layout1';
  const img = productImage(item, product);
  const qr = useQr(fields.qr && publicUrl ? `${publicUrl}#${product.slug || product.id}` : undefined);
  const theme = settings.theme || { bg: '#0b0b0d', text: '#f5f5f5', accent: '#c9a227' };

  const specs = [
    ['wavelengths', 'Wellenlängen'], ['power', 'Leistung'], ['cooling', 'Kühlung'],
    ['spot_sizes', 'Spotgrößen'], ['laser_class', 'Laserklasse'], ['model', 'Modell'],
  ].filter(([k]) => fields[k as string] && product[k as string]);

  const savings = (() => {
    if (!settings.showSavings) return null;
    const uvp = list.find(l => l.key === 'uvp')?.raw || 0;
    const promo = list.find(l => l.key === 'promo')?.raw || 0;
    if (uvp > 0 && promo > 0 && promo < uvp) return Math.round(((uvp - promo) / uvp) * 100);
    return null;
  })();

  const Badges = () => (
    <div className="flex flex-wrap gap-1">
      {(item.badges || []).map((b: string) => (
        <span key={b} className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: theme.accent, color: '#000' }}>{b}</span>
      ))}
      {savings ? <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-600 text-white">Sie sparen {savings} %</span> : null}
    </div>
  );

  const Img = ({ className = '' }: { className?: string }) => (
    img ? <img src={img} alt={product.name} className={`object-contain ${className}`} loading="lazy" />
      : <div className={`flex items-center justify-center text-xs opacity-40 ${className}`}>kein Bild</div>
  );

  const body = (() => {
    if (layout === 'layout3') return (
      <div className="h-full flex flex-col">
        <Img className="flex-1 w-full" />
        <div className="space-y-2">
          <Badges />
          <div className="text-3xl font-bold">{product.name}</div>
          {list[0] && <div className="text-5xl font-bold" style={{ color: theme.accent }}>{list[0].value}</div>}
          {list.slice(1).map(p => <Price key={p.key} p={p} />)}
        </div>
      </div>
    );
    if (layout === 'layout2') return (
      <div className="h-full flex flex-col gap-3">
        <Img className="w-full h-[45%]" />
        <Badges />
        <div className="text-2xl font-bold">{product.name}</div>
        {fields.short_description && <div className="text-xs opacity-80">{product.short_description}</div>}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          {specs.map(([k, l]) => <div key={k as string}><span className="opacity-60">{l}: </span>{product[k as string]}</div>)}
        </div>
        <div className="mt-auto space-y-1">{list.map(p => <Price key={p.key} p={p} />)}</div>
      </div>
    );
    if (layout === 'layout4') return (
      <div className="h-full flex flex-col gap-3">
        <div className="flex gap-4">
          <Img className="w-1/3 h-32" />
          <div className="flex-1">
            <Badges />
            <div className="text-2xl font-bold">{product.name}</div>
            {fields.short_description && <div className="text-xs opacity-80">{product.short_description}</div>}
          </div>
        </div>
        <table className="w-full text-[11px]">
          <tbody>
            {specs.map(([k, l]) => (
              <tr key={k as string} className="border-b border-current/10"><td className="py-1 opacity-60 w-1/3">{l}</td><td className="py-1">{product[k as string]}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-auto space-y-1">{list.map(p => <Price key={p.key} p={p} />)}</div>
      </div>
    );
    // layout1 (default)
    return (
      <div className="h-full flex gap-5">
        <Img className="w-1/2 h-full" />
        <div className="w-1/2 flex flex-col gap-2">
          <Badges />
          <div className="text-2xl font-bold leading-tight">{product.name}</div>
          {fields.short_description && <div className="text-xs opacity-80">{product.short_description}</div>}
          {fields.features && Array.isArray(product.features) && (
            <ul className="text-[11px] list-disc pl-4 space-y-0.5 opacity-90">
              {product.features.slice(0, 6).map((f: any, i: number) => <li key={i}>{typeof f === 'string' ? f : f?.text || ''}</li>)}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {specs.map(([k, l]) => <div key={k as string}><span className="opacity-60">{l}: </span>{product[k as string]}</div>)}
          </div>
          <div className="mt-auto space-y-1">{list.map(p => <Price key={p.key} p={p} />)}</div>
          {qr && <img src={qr} alt="QR-Code" className="w-16 h-16 bg-white p-1 rounded" />}
        </div>
      </div>
    );
  })();

  return (
    <Page style={{ background: theme.bg, color: theme.text }}>
      <Header catalog={catalog} />
      <div className="absolute inset-0 pt-[9%] pb-[12%] px-[6%]">{body}</div>
      <Footer catalog={catalog} page={page} />
    </Page>
  );
}

export function CatalogPricelistPage({ catalog, items, products, page }: any) {
  const s: PhCatalogSettings = { ...defaultSettings(), ...(catalog.settings || {}) };
  const theme = s.theme;
  return (
    <Page style={{ background: theme.bg, color: theme.text }}>
      <Header catalog={catalog} />
      <div className="absolute inset-0 pt-[9%] pb-[12%] px-[6%] overflow-hidden">
        <div className="text-xl font-bold mb-3">Preisübersicht</div>
        <table className="w-full text-[10px]">
          <thead><tr className="border-b border-current/30 text-left">
            <th className="py-1">Produkt</th>
            {(s.priceKinds || []).map(k => <th key={k} className="py-1">{PH_PRICE_KINDS.find(p => p.key === k)?.label}</th>)}
          </tr></thead>
          <tbody>
            {items.map((it: any) => {
              const p = products.find((x: any) => x.id === it.product_id);
              if (!p) return null;
              const { list } = itemPrices(catalog, it, p);
              return (
                <tr key={it.id} className="border-b border-current/10">
                  <td className="py-1 font-medium">{p.name}</td>
                  {(s.priceKinds || []).map(k => <td key={k} className="py-1">{list.find(l => l.key === k)?.value || '—'}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Footer catalog={catalog} page={page} />
    </Page>
  );
}

export function CatalogContentPage({ catalog, page, index }: any) {
  const s: PhCatalogSettings = { ...defaultSettings(), ...(catalog.settings || {}) };
  const cfg = page.config || {};
  const theme = s.theme;
  return (
    <Page style={{ background: cfg.bg || theme.bg, color: cfg.color || theme.text }}>
      {cfg.image && <img src={cfg.image} alt={page.title || 'Katalogseite'} className="absolute inset-0 w-full h-full object-cover" />}
      {cfg.image && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(cfg.overlay ?? 40) / 100})` }} />}
      <Header catalog={catalog} />
      <div className="absolute inset-0 pt-[12%] pb-[12%] px-[6%] flex flex-col gap-3">
        <div className="text-3xl font-bold">{page.title}</div>
        {cfg.text && <div className="text-sm whitespace-pre-line opacity-90 max-w-[80%]">{cfg.text}</div>}
      </div>
      <Footer catalog={catalog} page={index} />
    </Page>
  );
}

export function CatalogOverviewPage({ catalog, items, products, page, perPage = 4 }: any) {
  const s: PhCatalogSettings = { ...defaultSettings(), ...(catalog.settings || {}) };
  const theme = s.theme;
  return (
    <Page style={{ background: theme.bg, color: theme.text }}>
      <Header catalog={catalog} />
      <div className="absolute inset-0 pt-[9%] pb-[12%] px-[6%]">
        <div className="grid grid-cols-2 gap-4 h-full">
          {items.slice(0, perPage).map((it: any) => {
            const p = products.find((x: any) => x.id === it.product_id);
            if (!p) return null;
            const { list } = itemPrices(catalog, it, p);
            const img = productImage(it, p);
            return (
              <div key={it.id} className="flex flex-col gap-1 border border-current/10 rounded p-2">
                {img ? <img src={img} alt={p.name} className="w-full h-24 object-contain" /> : null}
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-[10px] opacity-70">{p.short_description}</div>
                <div className="mt-auto text-[11px] space-y-0.5">{list.slice(0, 3).map(l => <Price key={l.key} p={l} />)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <Footer catalog={catalog} page={page} />
    </Page>
  );
}

/** Kompletter Katalog – identische Darstellung für Vorschau, Online-Katalog und PDF. */
export function CatalogView({ catalog, items, products, pages, device = 'desktop', publicUrl }: CatalogRenderProps) {
  const width = device === 'mobile' ? 380 : device === 'tablet' ? 640 : 820;
  const visible = items.filter(i => i.visible !== false);
  let counter = 1;

  const ordered = [...(pages || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const hasCover = ordered.some(p => p.page_type === 'cover');

  return (
    <div className="ph-catalog-view mx-auto" style={{ width, maxWidth: '100%' }}>
      {!hasCover && <CatalogCover catalog={catalog} publicUrl={publicUrl} />}
      {ordered.map(pg => {
        const idx = counter++;
        if (pg.page_type === 'cover') return <CatalogCover key={pg.id} catalog={catalog} publicUrl={publicUrl} />;
        if (pg.page_type === 'pricelist') return <CatalogPricelistPage key={pg.id} catalog={catalog} items={visible} products={products} page={idx} />;
        if (pg.page_type === 'overview') return <CatalogOverviewPage key={pg.id} catalog={catalog} items={visible} products={products} page={idx} perPage={pg.config?.perPage || 4} />;
        if (pg.page_type === 'products') {
          return visible.map(it => {
            const p = products.find((x: any) => x.id === it.product_id);
            if (!p) return null;
            return <CatalogProductPage key={it.id} catalog={catalog} item={it} product={p} publicUrl={publicUrl} page={counter++} />;
          });
        }
        return <CatalogContentPage key={pg.id} catalog={catalog} page={pg} index={idx} />;
      })}
      {ordered.length === 0 && visible.map(it => {
        const p = products.find((x: any) => x.id === it.product_id);
        if (!p) return null;
        return <CatalogProductPage key={it.id} catalog={catalog} item={it} product={p} publicUrl={publicUrl} page={counter++} />;
      })}
    </div>
  );
}
