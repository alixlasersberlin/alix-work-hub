import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function KatalogLaender() {
  const client = supabase as any;
  const [countries, setCountries] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [c, cur, l] = await Promise.all([
        client.from('catalog_countries').select('*').order('sort_order'),
        client.from('catalog_currencies').select('*').order('code'),
        client.from('catalog_languages').select('*').order('sort_order'),
      ]);
      setCountries(c.data ?? []);
      setCurrencies(cur.data ?? []);
      setLanguages(l.data ?? []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Länder</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>ISO</TableHead><TableHead>Name</TableHead><TableHead>Währung</TableHead><TableHead>Sprache</TableHead><TableHead>Steuer</TableHead><TableHead>Aktiv</TableHead></TableRow></TableHeader>
            <TableBody>
              {countries.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.iso_code}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.currency_code}</TableCell>
                  <TableCell>{c.default_language ?? '—'}</TableCell>
                  <TableCell>{c.default_tax_rate}%</TableCell>
                  <TableCell>{c.is_active ? <Badge>aktiv</Badge> : <Badge variant="secondary">inaktiv</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Währungen</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Symbol</TableHead><TableHead>Name</TableHead><TableHead>Rundung</TableHead></TableRow></TableHeader>
            <TableBody>{currencies.map((c) => (
              <TableRow key={c.code}><TableCell className="font-mono">{c.code}</TableCell><TableCell>{c.symbol}</TableCell><TableCell>{c.name}</TableCell><TableCell>{c.rounding}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Sprachen</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Standard</TableHead><TableHead>Aktiv</TableHead></TableRow></TableHeader>
            <TableBody>{languages.map((l) => (
              <TableRow key={l.code}><TableCell className="font-mono">{l.code}</TableCell><TableCell>{l.name}</TableCell><TableCell>{l.is_default ? '✓' : ''}</TableCell><TableCell>{l.is_active ? '✓' : ''}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
