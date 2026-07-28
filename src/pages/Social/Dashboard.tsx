import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Users, Send, CheckCircle2, Plus, BarChart3 } from 'lucide-react';

export default function SocialDashboard() {
  const [stats, setStats] = useState({ clients: 0, accounts: 0, drafts: 0, scheduled: 0, published: 0, pending: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: clients }, { count: accounts }, posts, appr] = await Promise.all([
        supabase.from('social_clients').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('social_accounts').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('social_posts').select('status').is('deleted_at', null),
        supabase.from('social_approvals').select('decision').eq('decision', 'pending'),
      ]);
      const drafts = posts.data?.filter(p => p.status === 'draft').length ?? 0;
      const scheduled = posts.data?.filter(p => p.status === 'scheduled').length ?? 0;
      const published = posts.data?.filter(p => p.status === 'published').length ?? 0;
      setStats({ clients: clients ?? 0, accounts: accounts ?? 0, drafts, scheduled, published, pending: appr.data?.length ?? 0 });
    })();
  }, []);

  const KPI = ({ icon: Icon, label, value, hint }: any) => (
    <Card className="border-border/50 bg-gradient-to-br from-card via-card to-card/50 backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 text-3xl font-semibold">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <Icon className="h-8 w-8 text-primary/70" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Social Media</h1>
          <p className="text-muted-foreground mt-1">Onboarding, Content, Kampagnen & Analytics</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/social/plattformen"><Users className="mr-2 h-4 w-4" />Kunden</Link></Button>
          <Button asChild><Link to="/social/onboarding"><Plus className="mr-2 h-4 w-4" />Neuer Kunde</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPI icon={Users} label="Kunden" value={stats.clients} />
        <KPI icon={Sparkles} label="Accounts" value={stats.accounts} />
        <KPI icon={BarChart3} label="Entwürfe" value={stats.drafts} />
        <KPI icon={Send} label="Geplant" value={stats.scheduled} />
        <KPI icon={CheckCircle2} label="Veröffentlicht" value={stats.published} />
        <KPI icon={CheckCircle2} label="Freigaben offen" value={stats.pending} />
      </div>

      <Card>
        <CardHeader><CardTitle>Schnellzugriff</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Button asChild variant="outline" className="justify-start h-16"><Link to="/social/onboarding"><Plus className="mr-2 h-5 w-5" />Onboarding-Wizard</Link></Button>
          <Button asChild variant="outline" className="justify-start h-16"><Link to="/social/plattformen"><Users className="mr-2 h-5 w-5" />Plattformen & Accounts</Link></Button>
          <Button asChild variant="outline" className="justify-start h-16"><Link to="/social/fragebogen"><Sparkles className="mr-2 h-5 w-5" />Marketing-Fragebogen</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
