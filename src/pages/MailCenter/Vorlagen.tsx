import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2, FileText } from 'lucide-react';

export default function MailCenterVorlagen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Vorlagen</h2>
          <p className="text-sm text-muted-foreground">Erstellen, bearbeiten und löschen Sie wiederverwendbare E-Mail Vorlagen.</p>
        </div>
        <Button disabled><Plus className="w-4 h-4 mr-2" /> Neue Vorlage</Button>
      </div>

      <Card className="card-glow">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Vorlagen suchen…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="vertrieb">Vertrieb</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Aktualisiert</TableHead>
                  <TableHead className="w-32 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <FileText className="w-8 h-8 opacity-40 mb-2" />
                      <p className="text-sm">Noch keine Vorlagen vorhanden.</p>
                      <p className="text-xs">Die Datenanbindung folgt im nächsten Schritt.</p>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow className="hidden">
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" disabled><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" disabled><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
