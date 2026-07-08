import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Check } from 'lucide-react';

interface Props {
  onSave: (dataUrl: string) => void;
  label?: string;
}

export default function SignaturePad({ onSave, label = 'Unterschrift' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--foreground') || '#000';
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const { x, y } = pos(e);
    const ctx = ref.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing) return;
    const { x, y } = pos(e);
    const ctx = ref.current!.getContext('2d')!;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const end = () => setDrawing(false);
  const clear = () => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };
  const save = () => onSave(ref.current!.toDataURL('image/png'));

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">{label}</div>
      <canvas
        ref={ref}
        className="w-full h-40 rounded-lg border border-border bg-muted/30 touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear}><Eraser className="h-4 w-4 mr-1" />Leeren</Button>
        <Button size="sm" onClick={save} disabled={!hasInk}><Check className="h-4 w-4 mr-1" />Speichern</Button>
      </div>
    </div>
  );
}
