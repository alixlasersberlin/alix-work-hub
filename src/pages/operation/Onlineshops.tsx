import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, RefreshCw, FlaskConical, Download, Save, Trash2, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { hollywoodSecretDocumentation } from '@/lib/hollywood-secret-docs';

type Price = {id:string;name:string;sku:string;standard_gross:number;tax_rate:number};
type Log = {id:string;created_at:string;source:string;event:string;external_id:string;status:string;message:string};
type Overview = {connection:{status:string;last_success_at:string|null;shop_config:{production_enabled:boolean;test_enabled:boolean;mappings:Record<string,string>;shipping_confirmed:boolean;free_shipping:boolean;shipping_price_id:string|null}};orders:number;sandbox_orders:number;failures:number};
type Keys = {sandbox:boolean;production:boolean};

async function request(action:string,payload:Record<string,unknown>={}) {
  const {data,error}=await supabase.functions.invoke('hollywood-secret-api/v1/admin',{body:{action,payload}});
  if(error) {
    let message='Verbindung nicht verfügbar.';
    if(error.context instanceof Response) {try {const body=await error.context.clone().json();message=body.error?.message ?? message;} catch { /* no provider details */ }}
    throw new Error(message);
  }
  return data;
}

export default function Onlineshops() {
  const [overview,setOverview]=useState<Overview|null>(null);
  const [keys,setKeys]=useState<Keys>({sandbox:false,production:false});
  const [prices,setPrices]=useState<Price[]>([]);
  const [logs,setLogs]=useState<Log[]>([]);
  const [total,setTotal]=useState(0);
  const [offset,setOffset]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [sku,setSku]=useState('');
  const [priceId,setPriceId]=useState('');
  const [shippingPrice,setShippingPrice]=useState('');
  const [testResult,setTestResult]=useState<{ok:boolean;checks:Record<string,boolean>}|null>(null);
  const config=overview?.connection.shop_config;
  const load=async() => {const [a,p,l]=await Promise.all([request('overview'),request('prices'),request('logs',{offset})]);setOverview(a.data);setKeys(a.key_status);setPrices(p.data);setLogs(l.data.rows);setTotal(l.data.total);};
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Verarbeitung fehlgeschlagen.');}finally{setBusy(false);}};
  useEffect(()=>{let active=true; setBusy(true); Promise.all([request('overview'),request('prices'),request('logs',{offset})]).then(([a,p,l])=>{if(!active)return;setOverview(a.data);setKeys(a.key_status);setPrices(p.data);setLogs(l.data.rows);setTotal(l.data.total);setError('');}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[offset]);
  const save=async(action:string,payload:Record<string,unknown>)=>{await request(action,payload);await load();};
  const download=()=>{const url=URL.createObjectURL(new Blob([hollywoodSecretDocumentation],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='AlixWork_Hollywood_Secret_API.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <div className="p-4 md:p-6 space-y-6">
    <PageHeader title="Onlineshops" icon={Store} breadcrumbs={[{label:'Einstellungen'},{label:'Schnittstellen'},{label:'Onlineshops'}]} actions={<><Button variant="outline" onClick={download}><Download className="h-4 w-4 mr-2"/>API-Dokumentation</Button><Button variant="outline" size="icon" title="Aktualisieren" aria-label="Aktualisieren" disabled={busy} onClick={()=>run(load)}><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/></Button></>}/>
    {error&&<div role="alert" className="border border-destructive rounded-md p-3 text-destructive">{error}</div>}
    <section className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
      <div><h2 className="text-xl font-semibold">Hollywood Secret</h2><p className="text-sm text-muted-foreground mt-1">Alix Deutschland</p><div className="flex gap-2 flex-wrap mt-3"><Badge variant="outline">{overview?.connection.status??'Nicht geprüft'}</Badge><Badge variant="secondary"><Lock className="h-3 w-3 mr-1"/>{config?.production_enabled?'Produktiv freigegeben':'Produktiv gesperrt'}</Badge></div></div>
      <Button disabled={busy||!keys.sandbox} onClick={()=>run(async()=>{setTestResult(await request('self_test'));await load();})}><FlaskConical className="h-4 w-4 mr-2"/>API-VERBINDUNG TESTEN</Button>
    </section>
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-5">
      {[['Echte Shop-Aufträge',overview?.orders],['Isolierte Testaufträge',overview?.sandbox_orders],['Fehler',overview?.failures],['Letzte Übertragung',overview?.connection.last_success_at?new Date(overview.connection.last_success_at).toLocaleString('de-DE'):'—']].map(([label,value])=><div key={String(label)}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-lg font-semibold mt-1">{value??'—'}</dd></div>)}
    </dl>
    {testResult&&<section className="border-y py-4"><h3 className="font-semibold mb-3">{testResult.ok?'Verbindungstest bestanden':'Verbindungstest nicht vollständig bestanden'}</h3><div className="flex gap-3 flex-wrap">{Object.entries(testResult.checks).map(([key,ok])=><Badge key={key} variant={ok?'secondary':'destructive'}>{({authentication:'Zugang',creation:'Testauftrag',duplicate:'Duplikatsperre',read_back:'Erneuter Abruf',conflict:'Konfliktsperre'} as Record<string,string>)[key]??key}: {ok?'JA':'NEIN'}</Badge>)}</div></section>}
    <Tabs defaultValue="connection"><TabsList className="flex-wrap h-auto"><TabsTrigger value="connection">Verbindung</TabsTrigger><TabsTrigger value="articles">Artikel & Versand</TabsTrigger><TabsTrigger value="logs">Übertragungen & Protokoll</TabsTrigger></TabsList>
      <TabsContent value="connection" className="space-y-5 pt-4"><dl className="grid sm:grid-cols-2 gap-4"><div><dt className="text-sm text-muted-foreground">Testzugang</dt><dd>{keys.sandbox?'Sicher eingerichtet':'Noch nicht eingerichtet'}</dd></div><div><dt className="text-sm text-muted-foreground">Produktivzugang</dt><dd>{keys.production?'Sicher eingerichtet':'Noch nicht eingerichtet'}</dd></div></dl><div className="flex items-center gap-3"><Switch id="hs-test" disabled={busy||!config} checked={config?.test_enabled??false} onCheckedChange={enabled=>run(()=>save('test_enabled',{enabled}))}/><Label htmlFor="hs-test">Isolierte Testübertragungen</Label></div>{config?.production_enabled&&<Button variant="destructive" disabled={busy} onClick={()=>run(()=>save('disable_production',{}))}><Lock className="h-4 w-4 mr-2"/>Produktivbetrieb sperren</Button>}</TabsContent>
      <TabsContent value="articles" className="space-y-6 pt-4"><section><h3 className="font-semibold mb-3">Artikelzuordnungen</h3><div className="grid md:grid-cols-[1fr_2fr_auto] gap-3 items-end"><div><Label htmlFor="hs-sku">Shop-SKU</Label><Input id="hs-sku" value={sku} onChange={e=>setSku(e.target.value)} maxLength={100}/></div><div><Label>Freigegebener AlixWork-Preis</Label><Select value={priceId} onValueChange={setPriceId}><SelectTrigger><SelectValue placeholder="Preis auswählen"/></SelectTrigger><SelectContent>{prices.map(p=><SelectItem key={p.id} value={p.id}>{p.name} · {p.standard_gross.toLocaleString('de-DE')} € · {p.tax_rate} %</SelectItem>)}</SelectContent></Select></div><Button disabled={busy||!sku||!priceId} onClick={()=>run(async()=>{await save('mapping',{sku,price_id:priceId});setSku('');setPriceId('');})}><Save className="h-4 w-4 mr-2"/>Zuordnen</Button></div><div className="divide-y mt-4">{Object.entries(config?.mappings??{}).map(([s,id])=><div key={s} className="flex items-center gap-3 py-3"><span className="font-mono break-all">{s}</span><span className="flex-1 text-sm text-muted-foreground break-all">{prices.find(p=>p.id===id)?.name??'Preis derzeit nicht freigegeben'}</span><Button variant="ghost" size="icon" aria-label={`Zuordnung ${s} entfernen`} title="Zuordnung entfernen" disabled={busy} onClick={()=>run(()=>save('remove_mapping',{sku:s}))}><Trash2 className="h-4 w-4"/></Button></div>)}{Object.keys(config?.mappings??{}).length===0&&<p className="text-muted-foreground py-4">Keine Artikel freigegeben.</p>}</div><Button asChild variant="outline"><Link to="/katalog/preise">Katalogpreise</Link></Button></section><section className="border-t pt-5"><h3 className="font-semibold mb-3">Versandregel</h3><p className="text-sm mb-3">{config?.shipping_confirmed?(config.free_shipping?'Kostenfreier Versand bestätigt':'Freigegebener Versandpreis hinterlegt'):'Noch nicht bestätigt'}</p><div className="flex gap-3 flex-wrap"><Select value={shippingPrice} onValueChange={setShippingPrice}><SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Versandpreis auswählen"/></SelectTrigger><SelectContent>{prices.map(p=><SelectItem key={p.id} value={p.id}>{p.name} · {p.standard_gross} €</SelectItem>)}</SelectContent></Select><Button disabled={busy||!shippingPrice} onClick={()=>run(()=>save('shipping',{price_id:shippingPrice,free_shipping:false}))}><Save className="h-4 w-4 mr-2"/>Versandpreis bestätigen</Button><Button variant="outline" disabled={busy} onClick={()=>run(()=>save('shipping',{free_shipping:true}))}>Kostenfreien Versand bestätigen</Button></div></section></TabsContent>
      <TabsContent value="logs" className="pt-4"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-3 pr-4">Zeitpunkt</th><th className="pr-4">Bereich</th><th className="pr-4">Vorgang</th><th className="pr-4">Status</th><th>Ergebnis / Referenz</th></tr></thead><tbody>{logs.map(l=><tr key={l.id} className="border-b"><td className="py-3 pr-4 whitespace-nowrap">{new Date(l.created_at).toLocaleString('de-DE')}</td><td className="pr-4">{l.source.split(':')[1]}</td><td className="pr-4">{l.event}</td><td className="pr-4"><Badge variant={l.status==='error'?'destructive':'outline'}>{l.status}</Badge></td><td className="max-w-80 break-words">{l.message}<span className="block text-xs text-muted-foreground break-all">{l.external_id}</span></td></tr>)}</tbody></table></div>{logs.length===0&&<p className="py-6 text-muted-foreground">Keine Übertragungen vorhanden.</p>}<div className="flex items-center justify-between pt-4 gap-3"><span className="text-sm text-muted-foreground">{total===0?'0':`${offset+1}–${Math.min(offset+50,total)}`} von {total}</span><div className="flex gap-2"><Button variant="outline" disabled={busy||offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Neuere</Button><Button variant="outline" disabled={busy||offset+50>=total} onClick={()=>setOffset(offset+50)}>Ältere</Button></div></div></TabsContent>
    </Tabs>
  </div>;
}