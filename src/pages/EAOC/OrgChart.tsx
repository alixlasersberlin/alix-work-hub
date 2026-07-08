import { eaoc } from "@/lib/eaoc/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, Users, UsersRound } from "lucide-react";

export default function OrgChart() {
  const companies = eaoc.list("companies");
  const locations = eaoc.list("locations");
  const departments = eaoc.list("departments");
  const teams = eaoc.list("teams");
  const users = eaoc.list("users");

  const roots = companies.filter(c => !c.parent);
  const renderCompany = (c: any, depth = 0): any => {
    const children = companies.filter(x => x.parent === c.id);
    return (
      <div key={c.id} className="ml-0" style={{ marginLeft: depth * 20 }}>
        <div className="flex items-center gap-2 py-1">
          <Building2 className="h-4 w-4 text-amber-300" />
          <span className="font-medium">{c.name}</span>
          <span className="text-xs text-muted-foreground">· {c.city} · {c.country}</span>
        </div>
        {children.map(ch => renderCompany(ch, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Organisationsdiagramm</h1>
        <p className="text-sm text-muted-foreground mt-1">Unternehmen → Standorte → Abteilungen → Teams → Mitarbeiter</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Konzernstruktur</CardTitle></CardHeader>
          <CardContent>{roots.map(r => renderCompany(r))}</CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Standorte & Abteilungen</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {locations.map(l => (
              <div key={l.id}>
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-300" /><span className="font-medium">{l.name}</span></div>
                <div className="ml-6 text-muted-foreground text-xs">{departments.slice(0, 4).map(d => d.name).join(" · ")}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Teams</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {teams.map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-amber-300" />
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">· Leitung: {t.lead} · {t.members} Mitglieder</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Mitarbeiter (Auszug)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-300" />
                <span className="font-medium">{u.name}</span>
                <span className="text-xs text-muted-foreground">· {u.role} · {u.location}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
