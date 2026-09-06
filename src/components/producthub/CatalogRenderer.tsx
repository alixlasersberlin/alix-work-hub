import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  PH_PRODUCT_FIELDS, PH_PAGE_TYPES, applyPriceRule, catalogMoney, defaultCover, defaultSettings, hubPrices,
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

/** Inhaltsverzeichnis – Seitenzahlen werden automatisch berechnet. */
export function CatalogTocPage({ catalog, entries, page, title }: any) {
  const s: PhCatalogSettings = { ...defaultSettings(), ...(catalog.settings || {}) };
  const theme = s.theme;
  return (
    <Page style={{ background: theme.bg, color: theme.text }}>
      <Header catalog={catalog} />
      <div className="absolute inset-0 pt-[10%] pb-[12%] px-[8%]">
        <div className="text-3xl font-bold mb-5">{title || 'Inhalt'}</div>
        <div className="space-y-1.5">
          {(entries || []).map((e: any, i: number) => (
            <div key={i} className={`flex items-baseline gap-2 ${e.level === 2 ? 'pl-5 text-[11px] opacity-80' : 'text-sm font-medium'}`}>
              <span className="truncate">{e.label}</span>
              <span className="flex-1 border-b border-dotted border-current/30 translate-y-[-3px]" />
              <span className="tabular-nums opacity-80">{e.page}</span>
            </div>
          ))}
          {(!entries || entries.length === 0) && <div className="text-xs opacity-60">Noch keine Seiten angelegt.</div>}
        </div>
      </div>
      <Footer catalog={catalog} page={page} />
    </Page>
  );
}

/** Kategorie-Trennseite mit großem Titel, Bild und Geräten dieser Kategorie. */
export function CatalogCategoryPage({ catalog, page, index, items, products }: any) {
  const s: PhCatalogSettings = { ...defaultSettings(), ...(catalog.settings || {}) };
  const cfg = page.config || {};
  const theme = s.theme;
  const cat = cfg.category || '';
  const inCat = (items || []).filter((it: any) => {
    const p = products.find((x: any) => x.id === it.product_id);
    return p && (!cat || (p.category || '') === cat);
  });
  return (
    <Page style={{ background: theme.bg, color: theme.text }}>
      {cfg.image && <img src={cfg.image} alt={page.title || cat} className="absolute inset-0 w-full h-full object-cover" />}
      {cfg.image && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(cfg.overlay ?? 55) / 100})` }} />}
      <Header catalog={catalog} />
      <div className="absolute inset-0 pt-[16%] pb-[12%] px-[8%] flex flex-col gap-4">
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.accent }}>Kategorie</div>
        <div className="text-5xl font-bold leading-none">{page.title || cat || 'Kategorie'}</div>
        <div className="h-1 w-24" style={{ background: theme.accent }} />
        {cfg.text && <div className="text-sm whitespace-pre-line opacity-90 max-w-[75%]">{cfg.text}</div>}
        {cfg.showProducts !== false && inCat.length > 0 && (
          <ul className="mt-auto grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] opacity-90">
            {inCat.slice(0, 16).map((it: any) => {
              const p = products.find((x: any) => x.id === it.product_id);
              return <li key={it.id} className="truncate border-b border-current/10 py-0.5">{p?.name}</li>;
            })}
          </ul>
        )}
      </div>
      <Footer catalog={catalog} page={index} />
    </Page>
  );
}

/** Rückseite – Kontakt, Claim, QR-Code. */
export function CatalogBackPage({ catalog, page, index, publicUrl }: any) {
  const s: PhCatalogSettings = { ...defaultSettings(), ...(catalog.settings || {}) };
  const cfg = page.config || {};
  const theme = s.theme;
  const qr = useQr(cfg.qr !== false && publicUrl ? publicUrl : undefined);
  const f = s.footer || ({} as any);
  return (
    <Page style={{ background: cfg.bg || theme.bg, color: cfg.color || theme.text }}>
      {cfg.image && <img src={cfg.image} alt={page.title || 'Rückseite'} className="absolute inset-0 w-full h-full object-cover" />}
      {cfg.image && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(cfg.overlay ?? 60) / 100})` }} />}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-4 px-[10%]">
        <div className="text-3xl font-bold">{page.title || f.company || 'Kontakt'}</div>
        <div className="h-1 w-16" style={{ background: theme.accent }} />
        {cfg.text && <div className="text-sm whitespace-pre-line opacity-90">{cfg.text}</div>}
        <div className="text-sm space-y-0.5 opacity-90">
          {f.address && <div>{f.address}</div>}
          {f.phone && <div>{f.phone}</div>}
          {f.email && <div>{f.email}</div>}
          {f.website && <div style={{ color: theme.accent }}>{f.website}</div>}
        </div>
        {qr && <img src={qr} alt="QR-Code zum Online-Katalog" className="w-24 h-24 bg-white p-1 rounded" />}
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-[8%] pb-[4%] text-[9px] opacity-60 text-center">{s.legal}</div>
    </Page>
  );
}

/** Kompletter Katalog – identische Darstellung für Vorschau, Online-Katalog und PDF. */
export function CatalogView({ catalog, items, products, pages, device = 'desktop', publicUrl }: CatalogRenderProps) {
  const width = device === 'mobile' ? 380 : device === 'tablet' ? 640 : 820;
  const visible = items.filter(i => i.visible !== false);

  const ordered = [...(pages || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const hasCover = ordered.some(p => p.page_type === 'cover');

  // 1. Durchgang: Seitenplan mit Seitenzahlen + Inhaltsverzeichnis-Einträgen
  type Slot = { kind: string; key: string; pg?: any; item?: any; page: number };
  const plan: Slot[] = [];
  const toc: { label: string; page: number; level: number }[] = [];
  let counter = 1;
  if (!hasCover) plan.push({ kind: 'cover', key: 'auto-cover', page: counter++ });
  const source = ordered.length ? ordered : visible.map(it => ({ id: `auto-${it.id}`, page_type: 'products', title: '' }));
  for (const pg of source) {
    if (pg.page_type === 'products') {
      const first = counter;
      for (const it of visible) {
        const p = products.find((x: any) => x.id === it.product_id);
        if (!p) continue;
        plan.push({ kind: 'product', key: it.id, item: it, page: counter });
        toc.push({ label: p.name, page: counter, level: 2 });
        counter++;
      }
      if (counter > first) toc.splice(toc.length - (counter - first), 0, { label: pg.title || 'Geräte', page: first, level: 1 });
      continue;
    }
    const page = counter++;
    plan.push({ kind: pg.page_type, key: pg.id, pg, page });
    if (pg.page_type !== 'cover' && pg.page_type !== 'toc') {
      toc.push({ label: pg.title || PH_PAGE_TYPES.find(t => t.key === pg.page_type)?.label || 'Seite', page, level: 1 });
    }
  }
  toc.sort((a, b) => a.page - b.page || b.level - a.level);

  return (
    <div className="ph-catalog-view mx-auto" style={{ width, maxWidth: '100%' }}>
      {plan.map(slot => {
        if (slot.kind === 'cover') return <CatalogCover key={slot.key} catalog={catalog} publicUrl={publicUrl} />;
        if (slot.kind === 'toc') return <CatalogTocPage key={slot.key} catalog={catalog} entries={toc} page={slot.page} title={slot.pg?.title} />;
        if (slot.kind === 'pricelist') return <CatalogPricelistPage key={slot.key} catalog={catalog} items={visible} products={products} page={slot.page} />;
        if (slot.kind === 'overview') return <CatalogOverviewPage key={slot.key} catalog={catalog} items={visible} products={products} page={slot.page} perPage={slot.pg?.config?.perPage || 4} />;
        if (slot.kind === 'category') return <CatalogCategoryPage key={slot.key} catalog={catalog} page={slot.pg} index={slot.page} items={visible} products={products} />;
        if (slot.kind === 'back') return <CatalogBackPage key={slot.key} catalog={catalog} page={slot.pg} index={slot.page} publicUrl={publicUrl} />;
        if (slot.kind === 'product') {
          const p = products.find((x: any) => x.id === slot.item.product_id);
          if (!p) return null;
          return <CatalogProductPage key={slot.key} catalog={catalog} item={slot.item} product={p} publicUrl={publicUrl} page={slot.page} />;
        }
        return <CatalogContentPage key={slot.key} catalog={catalog} page={slot.pg} index={slot.page} />;
      })}
    </div>
  );
}
