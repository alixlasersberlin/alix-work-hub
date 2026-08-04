import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { signedThumbMap } from '@/lib/storage/thumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, Image as ImageIcon, Trash2 } from 'lucide-react';

type Asset = {
  id: string; client_id: string; file_name: string; storage_path: string;
  mime_type: string | null; size_bytes: number | null; category: string | null;
  tags: string[] | null; created_at: string;
};

const CATEGORIES = ['Logo','Produkt','Team','Referenz','Kampagne','Sonstiges'];

export default function SocialMedien() {
  const [clients, setClients] = useState<Array<{ id: string; company_name: string }>>([]);
  const [clientId, setClientId] = useState<string>('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>('Sonstiges');

  useEffect(() => {
    supabase.from('social_clients').select('id,company_name').is('deleted_at', null).order('company_name').then(({ data }) => setClients(data ?? []));
  }, []);

  async function load() {
    if (!clientId) { setAssets([]); return; }
    const { data } = await supabase.from('social_media_library')
      .select('*').eq('client_id', clientId).is('deleted_at', null).order('created_at', { ascending: false });
    const list = (data ?? []) as Asset[];
    setAssets(list);
    const p = await signedThumbMap(
      'social-media-library',
      list.map(a => ({ key: a.id, path: a.storage_path })),
      { width: 480, quality: 70 },
    );
    setPreviews(p);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  async function upload(files: FileList | null) {
    if (!files || !clientId) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    for (const file of Array.from(files)) {
      const path = `${clientId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('social-media-library').upload(path, file, { upsert: false });
      if (upErr) { toast.error(upErr.message); continue; }
      const { error: dbErr } = await supabase.from('social_media_library').insert({
        client_id: clientId, file_name: file.name, storage_path: path,
        mime_type: file.type, size_bytes: file.size, category, uploaded_by: user?.id ?? null,
      });
      if (dbErr) toast.error(dbErr.message);
    }
    setUploading(false);
    toast.success('Hochgeladen');
    load();
  }

  async function remove(a: Asset) {
    if (!confirm(`"${a.file_name}" löschen?`)) return;
    await supabase.storage.from('social-media-library').remove([a.storage_path]);
    await supabase.from('social_media_library').update({ deleted_at: new Date().toISOString() }).eq('id', a.id);
    toast.success('Gelöscht');
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Medien-Bibliothek</h1>
        <p className="text-muted-foreground mt-1">Bilder, Videos & Assets pro Kunde</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Upload</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Kunde</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="wählen…" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dateien</Label>
            <Input type="file" multiple disabled={!clientId || uploading}
              accept="image/*,video/*"
              onChange={e => upload(e.target.files)} />
          </div>
        </CardContent>
      </Card>

      {clientId && (
        <Card>
          <CardHeader><CardTitle>{assets.length} Assets</CardTitle></CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                Noch keine Dateien
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                {assets.map(a => (
                  <div key={a.id} className="group relative rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                    {a.mime_type?.startsWith('image/') && previews[a.id]
                      ? <img src={previews[a.id]} alt={a.file_name} className="w-full h-32 object-cover" />
                      : <div className="w-full h-32 flex items-center justify-center text-muted-foreground text-xs">{a.mime_type ?? 'Datei'}</div>}
                    <div className="p-2 space-y-1">
                      <div className="text-xs truncate" title={a.file_name}>{a.file_name}</div>
                      {a.category && <Badge variant="outline" className="text-[10px]">{a.category}</Badge>}
                    </div>
                    <Button size="icon" variant="destructive"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition h-7 w-7"
                      onClick={() => remove(a)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
