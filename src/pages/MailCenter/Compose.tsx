import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, UserRound, Building2, Phone, Mail, Hash, Paperclip, Upload,
  Bold, Italic, Underline as UnderlineIcon, List, Table as TableIcon, Link as LinkIcon,
  Image as ImageIcon, MousePointer, Eye, Beaker, Save, Send,
} from 'lucide-react';

const SENDERS: Record<string, { label: string; email: string }> = {
  finance: { label: 'Finance', email: 'finance@alixwork.de' },
  vertrieb: { label: 'Vertrieb', email: 'vertrieb@alixwork.de' },
  service: { label: 'Service', email: 'service@alixwork.de' },
  marketing: { label: 'Marketing', email: 'news@alixwork.de' },
};

const TEMPLATES = [
  'Auftragsbestätigung',
  'Angebot',
  'Rechnung',
  'Mahnung',
  'Reparaturannahme',
  'Reparatur abgeschlossen',
  'Lieferbestätigung',
  'Bewertungseinladung',
  'Newsletter',
  'Freie Nachricht',
];

const ACCEPTED_TYPES = '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip';

function ToolbarButton({ icon: Icon, label }: { icon: typeof Bold; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={label}
      className="h-8 w-8 p-0"
      disabled
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
}

export default function MailCenterCompose() {
  const [sender, setSender] = useState<keyof typeof SENDERS>('finance');
  const [template, setTemplate] = useState<string>('Freie Nachricht');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const senderEmail = useMemo(() => SENDERS[sender]?.email ?? '', [sender]);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...list]);
    e.target.value = '';
  }

  return (
    <div className="space-y-6">
      {/* Bereich 1 – Empfänger */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <UserRound className="w-4 h-4 text-primary" /> Empfänger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Kunde suchen…"
              className="pl-9"
              disabled
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Firma</Label>
              <Input placeholder="—" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><UserRound className="w-3.5 h-3.5" /> Ansprechpartner</Label>
              <Input placeholder="—" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> E-Mail</Label>
              <Input placeholder="—" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Telefon</Label>
              <Input placeholder="—" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Kundennummer</Label>
              <Input placeholder="—" disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bereich 2 + 3 – Absender & Vorlage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" /> Absender
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={sender} onValueChange={(v) => setSender(v as keyof typeof SENDERS)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SENDERS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Absenderadresse: </span>
              <span className="font-mono text-foreground">{senderEmail}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Beaker className="w-4 h-4 text-primary" /> Vorlage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger><SelectValue placeholder="Vorlage wählen…" /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Bereich 4 – Betreff */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display">Betreff</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Betreff der E-Mail…"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="text-base"
          />
        </CardContent>
      </Card>

      {/* Bereich 5 – Editor */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display">E-Mail Inhalt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/30 p-1">
            <ToolbarButton icon={Bold} label="Fett" />
            <ToolbarButton icon={Italic} label="Kursiv" />
            <ToolbarButton icon={UnderlineIcon} label="Unterstrichen" />
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarButton icon={List} label="Listen" />
            <ToolbarButton icon={TableIcon} label="Tabelle" />
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarButton icon={LinkIcon} label="Link" />
            <ToolbarButton icon={ImageIcon} label="Bild" />
            <ToolbarButton icon={MousePointer} label="Button" />
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Inhalt der E-Mail…"
            className="min-h-[300px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Rich-Text-Editor (HTML) wird in einem späteren Schritt integriert.
          </p>
        </CardContent>
      </Card>

      {/* Bereich 6 – Anhänge */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-primary" /> Anhänge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 cursor-pointer hover:bg-muted/30 transition-colors">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm text-foreground">Dateien auswählen oder hierher ziehen</span>
            <span className="text-xs text-muted-foreground">
              Erlaubt: PDF, DOCX, XLSX, PNG, JPG, ZIP
            </span>
            <input
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              onChange={onFiles}
              className="hidden"
            />
          </label>
          {files.length > 0 && (
            <ul className="space-y-1 text-sm">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-1.5"
                >
                  <span className="truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground ml-3">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Bereich 7 – Aktionen */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" disabled><Eye className="w-4 h-4 mr-2" /> Vorschau</Button>
        <Button variant="outline" disabled><Beaker className="w-4 h-4 mr-2" /> Testmail</Button>
        <Button variant="outline" disabled><Save className="w-4 h-4 mr-2" /> Speichern</Button>
        <Button disabled><Send className="w-4 h-4 mr-2" /> Senden</Button>
      </div>
    </div>
  );
}
