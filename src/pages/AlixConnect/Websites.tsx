import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Globe, Plus, Trash2, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

type Website = {
  id: string;
  domain: string;
  project_name: string;
  operator: string | null;
  primary_color: string;
  language: string;
  chat_enabled: boolean;
  analytics_enabled: boolean;
  cookieless_analytics: boolean;
  api_key: string;
  status: string;
  created_at: string;
};

export default function WebsitesPage() {
  const [sites, setSites] = useState<Website[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    domain: "",
    project_name: "",
    operator: "",
    primary_color: "#D4AF37",
    language: "de",
    welcome_message: "Hallo 👋 Wie können wir helfen?",
    chat_enabled: true,
    analytics_enabled: true,
    cookieless_analytics: true,
  });

  async function load() {
    const { data, error } = await supabase
      .from("ac_websites")
      .select("id, domain, project_name, operator, primary_color, language, chat_enabled, analytics_enabled, cookieless_analytics, api_key, status, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setSites((data as any) || []);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.domain || !form.project_name) return toast.error("Domain und Projektname erforderlich");
    const { error } = await supabase.from("ac_websites").insert(form as any);
    if (error) return toast.error(error.message);
    toast.success("Webseite angelegt");
    setOpen(false);
    setForm({ ...form, domain: "", project_name: "", operator: "" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Webseite wirklich löschen?")) return;
    const { error } = await supabase.from("ac_websites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht");
    load();
  }

  function embedSnippet(w: Website) {
    return `<script async src="${window.location.origin}/connect.js" data-key="${w.api_key}"></script>`;
  }

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Globe className="h-5 w-5" /> Webseiten</h2>
          <p className="text-sm text-muted-foreground">Verwalte alle Domains, die ALIX CONNECT (Chat, Analytics, Umfragen) nutzen.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Neue Webseite</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Neue Webseite</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Domain *</Label>
                <Input placeholder="alix-lasers.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
              </div>
              <div>
                <Label>Projektname *</Label>
                <Input placeholder="Alix Lasers" value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} />
              </div>
              <div>
                <Label>Betreiber</Label>
                <Input placeholder="Alix GmbH" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Primärfarbe</Label>
                  <Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
                </div>
                <div>
                  <Label>Sprache</Label>
                  <Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Begrüßung</Label>
                <Textarea value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded border p-2">
                <span className="text-sm">Chat-Widget</span>
                <Switch checked={form.chat_enabled} onCheckedChange={(v) => setForm({ ...form, chat_enabled: v })} />
              </div>
              <div className="flex items-center justify-between rounded border p-2">
                <span className="text-sm">Analytics (cookieless)</span>
                <Switch checked={form.analytics_enabled} onCheckedChange={(v) => setForm({ ...form, analytics_enabled: v })} />
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Anlegen</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Aktive Webseiten ({sites.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Projekt</TableHead>
                <TableHead>Chat</TableHead>
                <TableHead>Analytics</TableHead>
                <TableHead>Einbindung</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.domain}</TableCell>
                  <TableCell>{s.project_name}</TableCell>
                  <TableCell>{s.chat_enabled ? <Badge>an</Badge> : <Badge variant="outline">aus</Badge>}</TableCell>
                  <TableCell>{s.analytics_enabled ? <Badge>an</Badge> : <Badge variant="outline">aus</Badge>}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { navigator.clipboard.writeText(embedSnippet(s)); toast.success("Snippet kopiert"); }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy Snippet
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/connect/websites/${s.id}/analytics`}>
                        <Button size="icon" variant="ghost" title="Analytics öffnen"><BarChart3 className="h-4 w-4" /></Button>
                      </Link>
                      <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sites.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Noch keine Webseiten. Lege deine erste Domain an.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
