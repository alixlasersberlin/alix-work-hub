import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FilePlus } from 'lucide-react';

export default function Angebote() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Angebote</h1>
            <p className="text-muted-foreground text-sm">Übersicht aller Angebote.</p>
          </div>
        </div>
        <Button asChild><Link to="/verkauf/angebot/neu"><FilePlus className="h-4 w-4 mr-2" />Neues Angebot</Link></Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Liste</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm py-10 text-center">
          Hier erscheinen Ihre erstellten Angebote.
        </CardContent>
      </Card>
    </div>
  );
}
