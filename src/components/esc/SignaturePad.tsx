import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Eraser, Check } from 'lucide-react';

interface Props {
  onCapture: (dataUrl: string) => void;
  label?: string;
}

export function SignaturePad({ onCapture, label = 'Unterschrift' }: Props) {
  const ref = useRef<SignatureCanvas | null>(null);
  const [empty, setEmpty] = useState(true);

  const clear = () => {
    ref.current?.clear();
    setEmpty(true);
  };

  const save = () => {
    if (!ref.current || ref.current.isEmpty()) return;
    const dataUrl = ref.current.getCanvas().toDataURL('image/png');
    onCapture(dataUrl);
  };

  return (
    <div className="space-y-2">
      <div className="text-[12px] font-medium">{label}</div>
      <div className="rounded-md border bg-white">
        <SignatureCanvas
          ref={(el) => { ref.current = el; }}
          penColor="#111"
          canvasProps={{ className: 'w-full h-40 rounded-md' }}
          onEnd={() => setEmpty(false)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <Eraser className="w-3.5 h-3.5 mr-1" /> Löschen
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={empty}>
          <Check className="w-3.5 h-3.5 mr-1" /> Übernehmen
        </Button>
      </div>
    </div>
  );
}
