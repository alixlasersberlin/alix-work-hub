import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, PenLine, Calendar, Type, Fingerprint, CheckSquare, MousePointer2 } from 'lucide-react';

export type SigField = {
  id: string;
  page: number; // 1-based
  x: number; // pt from left in PDF space (top-left origin, editor coords)
  y: number; // pt from top in PDF space
  width: number;
  height: number;
  signer_index: number; // matches sig_signers.order_index
  field_type: 'signature' | 'date' | 'text' | 'initials' | 'checkbox';
  field_key: string;
};

export type EditorSigner = { name?: string; email?: string; order_index: number };

const SIGNER_COLORS = [
  { bg: 'rgba(59,130,246,0.20)', border: '#3b82f6', text: '#1e40af' },
  { bg: 'rgba(16,185,129,0.20)', border: '#10b981', text: '#047857' },
  { bg: 'rgba(249,115,22,0.22)', border: '#f97316', text: '#b45309' },
  { bg: 'rgba(168,85,247,0.20)', border: '#a855f7', text: '#6b21a8' },
  { bg: 'rgba(236,72,153,0.20)', border: '#ec4899', text: '#9d174d' },
];

const FIELD_DEFAULTS: Record<SigField['field_type'], { w: number; h: number; icon: any; label: string }> = {
  signature: { w: 200, h: 60, icon: PenLine, label: 'Unterschrift' },
  date: { w: 110, h: 26, icon: Calendar, label: 'Datum' },
  text: { w: 160, h: 26, icon: Type, label: 'Text' },
  initials: { w: 60, h: 40, icon: Fingerprint, label: 'Kürzel' },
  checkbox: { w: 22, h: 22, icon: CheckSquare, label: 'Kästchen' },
};

interface Props {
  file: File | null;
  signers: EditorSigner[];
  fields: SigField[];
  onChange: (fields: SigField[]) => void;
}

type PageInfo = { pageNum: number; widthPt: number; heightPt: number; scale: number; canvasW: number; canvasH: number };

export default function FieldEditor({ file, signers, fields, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [activeSigner, setActiveSigner] = useState(0);
  const [activeType, setActiveType] = useState<SigField['field_type']>('signature');
  const [tool, setTool] = useState<'place' | 'select'>('place');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const RENDER_SCALE = 1.2;

  useEffect(() => {
    if (!file) { setPages([]); return; }
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const pdfjs: any = await import('pdfjs-dist');
        const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const buf = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        const infos: PageInfo[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width; canvas.height = vp.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          infos.push({
            pageNum: i,
            widthPt: vp.width / RENDER_SCALE,
            heightPt: vp.height / RENDER_SCALE,
            scale: RENDER_SCALE,
            canvasW: vp.width,
            canvasH: vp.height,
          });
          // stash dataUrl on window map via id
          (window as any).__sigPageImg = (window as any).__sigPageImg || {};
          (window as any).__sigPageImg[`${file.name}::${i}`] = dataUrl;
        }
        if (!cancelled) setPages(infos);
      } finally { if (!cancelled) setRendering(false); }
    })();
    return () => { cancelled = true; };
  }, [file]);

  const addFieldAt = useCallback((pageNum: number, xCanvas: number, yCanvas: number) => {
    const p = pages.find((x) => x.pageNum === pageNum);
    if (!p) return;
    const defaults = FIELD_DEFAULTS[activeType];
    // Convert canvas coords → pdf points (top-left origin)
    const xPt = xCanvas / p.scale - defaults.w / 2;
    const yPt = yCanvas / p.scale - defaults.h / 2;
    const nf: SigField = {
      id: crypto.randomUUID(),
      page: pageNum,
      x: Math.max(0, Math.min(p.widthPt - defaults.w, xPt)),
      y: Math.max(0, Math.min(p.heightPt - defaults.h, yPt)),
      width: defaults.w,
      height: defaults.h,
      signer_index: activeSigner,
      field_type: activeType,
      field_key: `${activeType}_${fields.length + 1}`,
    };
    onChange([...fields, nf]);
    setSelectedId(nf.id);
    setTool('select');
  }, [activeSigner, activeType, fields, onChange, pages]);

  const updateField = (id: string, patch: Partial<SigField>) => {
    onChange(fields.map((f) => f.id === id ? { ...f, ...patch } : f));
  };
  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const onPageClick = (e: React.MouseEvent, p: PageInfo) => {
    if (tool !== 'place') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    addFieldAt(p.pageNum, e.clientX - rect.left, e.clientY - rect.top);
  };

  const startDrag = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    e.stopPropagation();
    const f = fields.find((x) => x.id === id); if (!f) return;
    const p = pages.find((x) => x.pageNum === f.page); if (!p) return;
    setSelectedId(id);
    const startX = e.clientX, startY = e.clientY;
    const orig = { ...f };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const dxPt = (ev.clientX - startX) / p.scale;
      const dyPt = (ev.clientY - startY) / p.scale;
      if (mode === 'move') {
        updateField(id, {
          x: Math.max(0, Math.min(p.widthPt - orig.width, orig.x + dxPt)),
          y: Math.max(0, Math.min(p.heightPt - orig.height, orig.y + dyPt)),
        });
      } else {
        updateField(id, {
          width: Math.max(20, Math.min(p.widthPt - orig.x, orig.width + dxPt)),
          height: Math.max(16, Math.min(p.heightPt - orig.y, orig.height + dyPt)),
        });
      }
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  };

  const totalPerSigner = useMemo(() => {
    const t: Record<number, number> = {};
    for (const f of fields) t[f.signer_index] = (t[f.signer_index] || 0) + 1;
    return t;
  }, [fields]);

  if (!file) return (
    <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
      Zuerst eine PDF-Datei auswählen.
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center p-2 rounded-lg border bg-muted/30 sticky top-0 z-20">
        <Button size="sm" variant={tool === 'select' ? 'default' : 'outline'} onClick={() => setTool('select')}>
          <MousePointer2 className="w-3 h-3 mr-1" />Auswählen
        </Button>
        <div className="w-px h-6 bg-border" />
        {(Object.keys(FIELD_DEFAULTS) as SigField['field_type'][]).map((t) => {
          const D = FIELD_DEFAULTS[t]; const Icon = D.icon;
          const isActive = tool === 'place' && activeType === t;
          return (
            <Button key={t} size="sm" variant={isActive ? 'default' : 'outline'}
              onClick={() => { setActiveType(t); setTool('place'); }}>
              <Icon className="w-3 h-3 mr-1" />{D.label}
            </Button>
          );
        })}
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Für Unterzeichner:</span>
          <Select value={String(activeSigner)} onValueChange={(v) => setActiveSigner(Number(v))}>
            <SelectTrigger className="w-56 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {signers.map((s, i) => (
                <SelectItem key={i} value={String(i)}>
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: SIGNER_COLORS[i % SIGNER_COLORS.length].border }} />
                  {s.name || s.email || `Unterzeichner ${i + 1}`}
                  {totalPerSigner[i] ? ` (${totalPerSigner[i]})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tool === 'place' && (
          <span className="text-xs text-muted-foreground ml-auto">
            Klick auf die Seite, um ein Feld zu platzieren.
          </span>
        )}
      </div>

      {rendering && <div className="p-4 text-center text-sm text-muted-foreground">Rendere PDF…</div>}

      <div ref={containerRef} className="space-y-4">
        {pages.map((p) => {
          const img = (window as any).__sigPageImg?.[`${file.name}::${p.pageNum}`];
          const pageFields = fields.filter((f) => f.page === p.pageNum);
          return (
            <div key={p.pageNum} className="relative mx-auto shadow-md rounded overflow-hidden bg-white"
              style={{ width: p.canvasW, height: p.canvasH, cursor: tool === 'place' ? 'crosshair' : 'default' }}
              onClick={(e) => onPageClick(e, p)}>
              {img && <img src={img} alt={`Seite ${p.pageNum}`} className="block w-full h-full select-none pointer-events-none" />}
              {pageFields.map((f) => {
                const c = SIGNER_COLORS[f.signer_index % SIGNER_COLORS.length];
                const D = FIELD_DEFAULTS[f.field_type];
                const Icon = D.icon;
                const isSel = f.id === selectedId;
                return (
                  <div key={f.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(f.id); setTool('select'); }}
                    onPointerDown={(e) => tool === 'select' && startDrag(e, f.id, 'move')}
                    className={`absolute rounded border-2 flex items-center justify-center text-[10px] font-medium ${isSel ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                    style={{
                      left: f.x * p.scale, top: f.y * p.scale,
                      width: f.width * p.scale, height: f.height * p.scale,
                      background: c.bg, borderColor: c.border, color: c.text,
                      cursor: tool === 'select' ? 'move' : 'crosshair',
                    }}>
                    <Icon className="w-3 h-3 mr-1" />{D.label}
                    {isSel && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); removeField(f.id); }}
                          className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-destructive text-white grid place-items-center shadow">
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <div onPointerDown={(e) => startDrag(e, f.id, 'resize')}
                          className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-sm cursor-se-resize" />
                      </>
                    )}
                  </div>
                );
              })}
              <div className="absolute top-1 left-1 px-2 py-0.5 rounded bg-black/60 text-white text-[10px]">
                Seite {p.pageNum}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
