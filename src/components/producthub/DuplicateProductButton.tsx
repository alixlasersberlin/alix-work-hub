import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function DuplicateProductButton({ productId, product }: { productId: string; product: any }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [withMedia, setWithMedia] = useState(true);
  const [withDocs, setWithDocs] = useState(true);

  const openDlg = () => {
    setName(`${product?.name || ''} (Kopie)`);
    setSku(product?.sku ? `${product.sku}-KOPIE` : '');
    setOpen(true);
  };

  const run = async () => {
    if (!name.trim() || !sku.trim()) { toast.error('Name und Artikelnummer sind Pflicht'); return; }
    setBusy(true);
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
      const { data: src, error: e1 } = await db.from('ph_products').select('*').eq('id', productId).single();
      if (e1) throw e1;
      const { id, created_at, updated_at, published_at, ...rest } = src;
      const row = {
        ...rest,
        name: name.trim(), sku: sku.trim(), status: 'draft',
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        alix_product_id: `ALX-${sku.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
        seo_title: null, seo_description: null,
        hero_image_url: withMedia ? rest.hero_image_url : null,
        created_by: uid, updated_by: uid,
      };
      const { data: created, error: e2 } = await db.from('ph_products').insert(row).select('id').single();
      if (e2) throw e2;
      const newId = created.id as string;
      if (withMedia) {
        const { data: m } = await db.from('ph_media').select('*').eq('product_id', productId);
        if (m?.length) await db.from('ph_media').insert(m.map(({ id, created_at, updated_at, ...x }: any) => ({ ...x, product_id: newId })));
      }
      if (withDocs) {
        const { data: d } = await db.from('ph_documents').select('*').eq('product_id', productId);
        if (d?.length) await db.from('ph_documents').insert(d.map(({ id, created_at, updated_at, ...x }: any) => ({ ...x, product_id: newId })));
      }
      toast.success('Artikel dupliziert und als Entwurf gespeichert');
      setOpen(false);
      nav(`/product-hub/geraete/${newId}`);
    } catch (e: any) {
      toast.error(e.message?.includes('duplicate') ? 'Artikelnummer oder ID existiert bereits' : e.message);
    } finally { setBusy(false); }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDlg}><Copy className="w-4 h-4 mr-1" /> Duplizieren</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Artikel duplizieren</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Neuer Produktname *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label className="text-xs">Neue Artikelnummer / SKU *</Label><Input value={sku} onChange={e => setSku(e.target.value)} /></div>
            <div className="flex items-center justify-between"><Label>Bilder übernehmen</Label><Switch checked={withMedia} onCheckedChange={setWithMedia} /></div>
            <div className="flex items-center justify-between"><Label>Dokumente übernehmen</Label><Switch checked={withDocs} onCheckedChange={setWithDocs} /></div>
            <p className="text-xs text-muted-foreground">Die Kopie wird als Entwurf gespeichert. SEO-Texte und Webseiten-Freigaben werden nicht übernommen.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={run} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Duplizieren & speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
