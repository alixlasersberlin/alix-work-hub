import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Users, Shield, ShieldOff, Search, Filter, Plus, Send, UserCheck, UserX, Lock,
  Unlock, ChevronLeft, Mail, Phone, Clock, Building2, Key, AlertTriangle,
  CheckCircle2, XCircle, Loader2, RefreshCw, Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';

/* ─── Types ─── */
interface EnrichedUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  account_status: string;
  invitation_status: string;
  otp_channel: string;
  is_active: boolean;
  password_reset_required: boolean;
  last_otp_verified_at: string | null;
  created_at: string;
  department_id: string | null;
  departments: { name: string } | null;
  roleNames: string[];
  roleIds: string[];
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface Department {
  id: string;
  name: string;
}

/* ─── Helpers ─── */
function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-success/15 text-success border-success/30',
    disabled: 'bg-muted text-muted-foreground border-border',
    locked: 'bg-destructive/15 text-destructive border-destructive/30',
    suspended: 'bg-destructive/15 text-destructive border-destructive/30',
  };
  return map[status] || 'bg-muted text-muted-foreground border-border';
}

function invitationBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-warning/15 text-warning border-warning/30',
    sent: 'bg-info/15 text-info border-info/30',
    accepted: 'bg-success/15 text-success border-success/30',
    expired: 'bg-destructive/15 text-destructive border-destructive/30',
  };
  return map[status] || 'bg-muted text-muted-foreground border-border';
}

function fmt(dateStr: string | null) {
  if (!dateStr) return '—';
  try { return format(new Date(dateStr), 'dd.MM.yyyy HH:mm'); } catch { return '—'; }
}

/* ─── Main Component ─── */
export default function UserManagement() {
  const { isAdmin } = useAuth();

  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'created'>('name');

  // Detail
  const [selectedUser, setSelectedUser] = useState<EnrichedUser | null>(null);
  const [userInvitations, setUserInvitations] = useState<any[]>([]);
  const [userAuditLogs, setUserAuditLogs] = useState<any[]>([]);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [showEditRoles, setShowEditRoles] = useState(false);
  const [showConfirmAction, setShowConfirmAction] = useState<{ action: string; user: EnrichedUser } | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    full_name: '', email: '', password: '', phone_number: '',
    department_id: '', otp_channel: 'sms', role_ids: [] as string[],
  });
  const [creating, setCreating] = useState(false);

  // Edit roles
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editDeptId, setEditDeptId] = useState('');
  const [editSupplierId, setEditSupplierId] = useState<string>('none');
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState(false);

  /* ─── Data loading ─── */
  const loadData = useCallback(async () => {
    setLoading(true);
    const [profilesRes, rolesRes, deptsRes, suppliersRes] = await Promise.all([
      supabase.from('user_profiles').select('*, departments(name)').order('created_at', { ascending: false }),
      supabase.from('roles').select('*').order('name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
    ]);

    setRoles(rolesRes.data ?? []);
    setDepartments(deptsRes.data ?? []);
    setSuppliers(suppliersRes.data ?? []);

    if (profilesRes.data) {
      const enriched = await Promise.all(
        profilesRes.data.map(async (p: any) => {
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role_id, roles(name)')
            .eq('user_id', p.id);
          return {
            ...p,
            roleNames: userRoles?.map((r: any) => r.roles?.name).filter(Boolean) ?? [],
            roleIds: userRoles?.map((r: any) => r.role_id).filter(Boolean) ?? [],
          };
        })
      );
      setUsers(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ─── Load detail ─── */
  const loadUserDetail = async (user: EnrichedUser) => {
    setSelectedUser(user);
    const [invRes, auditRes] = await Promise.all([
      supabase.from('user_invitations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('audit_logs').select('*').eq('record_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);
    setUserInvitations(invRes.data ?? []);
    setUserAuditLogs(auditRes.data ?? []);
  };

  /* ─── Filtered + sorted ─── */
  const filteredUsers = useMemo(() => {
    let list = [...users];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.full_name?.toLowerCase().includes(q)) ||
        (u.email?.toLowerCase().includes(q))
      );
    }
    if (filterStatus !== 'all') list = list.filter(u => u.account_status === filterStatus);
    if (filterDept !== 'all') list = list.filter(u => u.department_id === filterDept);
    if (filterRole !== 'all') list = list.filter(u => u.roleNames.includes(filterRole));

    list.sort((a, b) => {
      if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [users, search, filterStatus, filterDept, filterRole, sortBy]);

  /* ─── Create user ─── */
  const handleCreate = async () => {
    if (!createForm.full_name || !createForm.email) {
      toast.error('Name und E-Mail sind Pflichtfelder');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          full_name: createForm.full_name,
          email: createForm.email,
          password: createForm.password || undefined,
          phone_number: createForm.phone_number || undefined,
          department_id: createForm.department_id || undefined,
          otp_channel: createForm.otp_channel,
          role_ids: createForm.role_ids,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Benutzer "${createForm.full_name}" erfolgreich erstellt`);
      setShowCreate(false);
      setCreateForm({ full_name: '', email: '', password: '', phone_number: '', department_id: '', otp_channel: 'sms', role_ids: [] });
      loadData();
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
    setCreating(false);
  };

  /* ─── Send invitation ─── */
  const handleSendInvitation = async (user: EnrichedUser) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-user-invitation', {
        body: { user_id: user.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Einladung an ${user.email} gesendet`);
      loadData();
      if (selectedUser?.id === user.id) loadUserDetail(user);
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
    setActionLoading(false);
  };

  /* ─── Approve invitation (Benutzer freischalten) ─── */
  const handleApproveInvitation = async (user: EnrichedUser) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          invitation_status: 'accepted',
          account_status: 'active',
          is_active: true,
        })
        .eq('id', user.id);
      if (error) throw error;
      await supabase.from('audit_logs').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id || null,
        action: 'invitation_approved',
        module: 'user_management',
        record_id: user.id,
        details: { email: user.email },
      });
      toast.success(`${user.full_name || user.email} freigeschaltet`);
      loadData();
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, invitation_status: 'accepted', account_status: 'active', is_active: true } : null);
      }
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
    setActionLoading(false);
  };

  /* ─── Status change ─── */
  const handleStatusChange = async (user: EnrichedUser, newStatus: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          account_status: newStatus,
          is_active: newStatus === 'active',
        })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(`Benutzerstatus auf "${newStatus}" geändert`);
      setShowConfirmAction(null);
      loadData();
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, account_status: newStatus, is_active: newStatus === 'active' } : null);
      }
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
    setActionLoading(false);
  };

  /* ─── Save roles + dept ─── */
  const handleSaveRoles = async () => {
    if (!selectedUser) return;
    setSavingRoles(true);
    try {
      // Delete existing roles
      await supabase.from('user_roles').delete().eq('user_id', selectedUser.id);
      // Insert new
      if (editRoleIds.length > 0) {
        await supabase.from('user_roles').insert(
          editRoleIds.map(role_id => ({ user_id: selectedUser.id, role_id }))
        );
      }
      // Update department + supplier
      const lieferantRoleId = roles.find(r => r.name === 'Lieferant')?.id;
      const isLieferant = lieferantRoleId ? editRoleIds.includes(lieferantRoleId) : false;
      await supabase.from('user_profiles').update({
        department_id: editDeptId && editDeptId !== 'none' ? editDeptId : null,
        supplier_id: isLieferant && editSupplierId !== 'none' ? editSupplierId : null,
      }).eq('id', selectedUser.id);

      toast.success('Rollen, Abteilung und Lieferant gespeichert');
      setShowEditRoles(false);
      loadData();
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
    setSavingRoles(false);
  };

  const openEditRoles = (user: EnrichedUser) => {
    setEditRoleIds([...user.roleIds]);
    setEditDeptId(user.department_id || '');
    setEditSupplierId((user as any).supplier_id || 'none');
    setSelectedUser(user);
    setShowEditRoles(true);
  };

  /* ─── Detail View ─── */
  if (selectedUser && !showEditRoles) {
    return (
      <div className="p-6 lg:p-8 animate-fade-in">
        <button onClick={() => setSelectedUser(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Zurück zur Liste
        </button>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Profile Card */}
          <div className="lg:w-1/3 space-y-4">
            <div className="rounded-xl border border-border bg-card card-glow p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center text-lg font-bold text-primary-foreground">
                  {(selectedUser.full_name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-foreground">{selectedUser.full_name || '—'}</h2>
                  <p className="text-sm text-muted-foreground">{selectedUser.email || '—'}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span>{selectedUser.phone_number || '—'}</span></div>
                <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /><span>{selectedUser.departments?.name || '—'}</span></div>
                <div className="flex items-center gap-2"><Key className="w-4 h-4 text-muted-foreground" /><span>OTP: {selectedUser.otp_channel}</span></div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><span>Erstellt: {fmt(selectedUser.created_at)}</span></div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><span>Letzte OTP: {fmt(selectedUser.last_otp_verified_at)}</span></div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge(selectedUser.account_status)}`}>
                  {selectedUser.account_status}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${invitationBadge(selectedUser.invitation_status)}`}>
                  {selectedUser.invitation_status}
                </span>
                {selectedUser.password_reset_required && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-warning/15 text-warning border-warning/30">
                    PW-Reset erforderlich
                  </span>
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-medium text-muted-foreground mb-2">Rollen</h3>
                <div className="flex flex-wrap gap-1">
                  {selectedUser.roleNames.length > 0 ? selectedUser.roleNames.map(r => (
                    <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      <Shield className="w-3 h-3" />{r}
                    </span>
                  )) : <span className="text-xs text-muted-foreground">Keine Rollen</span>}
                </div>
              </div>
            </div>

            {/* Actions */}
            {isAdmin && (
              <div className="rounded-xl border border-border bg-card card-glow p-4 space-y-2">
                <h3 className="text-sm font-medium text-foreground mb-2">Aktionen</h3>
                <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => openEditRoles(selectedUser)}>
                  <Edit3 className="w-4 h-4" /> Rollen & Abteilung bearbeiten
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start gap-2" disabled={actionLoading} onClick={() => handleSendInvitation(selectedUser)}>
                  <Send className="w-4 h-4" /> Einladung {selectedUser.invitation_status === 'sent' ? 'erneut ' : ''}senden
                </Button>
                {selectedUser.invitation_status !== 'accepted' && (
                  <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-success hover:text-success" disabled={actionLoading} onClick={() => handleApproveInvitation(selectedUser)}>
                    <UserCheck className="w-4 h-4" /> Benutzer freischalten
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start gap-2 text-warning hover:text-warning"
                  disabled={actionLoading}
                  onClick={async () => {
                    if (!confirm(`2FA für ${selectedUser.full_name || selectedUser.email} zurücksetzen? Der User muss beim nächsten Login neu einrichten.`)) return;
                    setActionLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('mfa-admin-reset', { body: { user_id: selectedUser.id } });
                      if (error) throw error;
                      if (!data?.success) throw new Error(data?.error || 'Reset fehlgeschlagen');
                      toast.success(`2FA zurückgesetzt (${data.factors_removed ?? 0} Faktor(en) entfernt)`);
                    } catch (e: any) {
                      toast.error('Fehler: ' + (e?.message ?? String(e)));
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  <ShieldOff className="w-4 h-4" /> 2FA zurücksetzen
                </Button>
                {selectedUser.account_status === 'active' ? (
                  <>
                    <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-warning hover:text-warning" onClick={() => setShowConfirmAction({ action: 'disabled', user: selectedUser })}>
                      <UserX className="w-4 h-4" /> Deaktivieren
                    </Button>
                    <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={() => setShowConfirmAction({ action: 'locked', user: selectedUser })}>
                      <Lock className="w-4 h-4" /> Sperren
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-success hover:text-success" onClick={() => setShowConfirmAction({ action: 'active', user: selectedUser })}>
                    <Unlock className="w-4 h-4" /> Aktivieren
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="lg:w-2/3">
            <Tabs defaultValue="invitations">
              <TabsList className="bg-secondary/50 border border-border">
                <TabsTrigger value="invitations">Einladungen</TabsTrigger>
                <TabsTrigger value="audit">Audit-Log</TabsTrigger>
              </TabsList>

              <TabsContent value="invitations" className="mt-4">
                <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">E-Mail</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Gesendet</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Läuft ab</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Angenommen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {userInvitations.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Keine Einladungen vorhanden</td></tr>
                      ) : userInvitations.map(inv => (
                        <tr key={inv.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${invitationBadge(inv.invitation_status)}`}>{inv.invitation_status}</span>
                          </td>
                          <td className="px-4 py-3 text-foreground">{inv.email}</td>
                          <td className="px-4 py-3 text-muted-foreground">{fmt(inv.sent_at)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{fmt(inv.expires_at)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{fmt(inv.accepted_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Aktion</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Modul</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Zeitpunkt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {userAuditLogs.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Keine Audit-Einträge</td></tr>
                      ) : userAuditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 text-foreground font-medium">{log.action}</td>
                          <td className="px-4 py-3 text-muted-foreground">{log.module}</td>
                          <td className="px-4 py-3 text-muted-foreground">{fmt(log.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Confirm Action Dialog */}
        <Dialog open={!!showConfirmAction} onOpenChange={() => setShowConfirmAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aktion bestätigen</DialogTitle>
              <DialogDescription>
                {showConfirmAction?.action === 'active' && `Möchten Sie "${showConfirmAction.user.full_name}" wieder aktivieren?`}
                {showConfirmAction?.action === 'disabled' && `Möchten Sie "${showConfirmAction?.user.full_name}" deaktivieren?`}
                {showConfirmAction?.action === 'locked' && `Möchten Sie "${showConfirmAction?.user.full_name}" sperren?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmAction(null)}>Abbrechen</Button>
              <Button
                variant={showConfirmAction?.action === 'active' ? 'default' : 'destructive'}
                disabled={actionLoading}
                onClick={() => showConfirmAction && handleStatusChange(showConfirmAction.user, showConfirmAction.action)}
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Bestätigen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ─── List View ─── */
  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Benutzerverwaltung
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filteredUsers.length} von {users.length} Benutzern</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowCreate(true)} className="gold-gradient text-primary-foreground">
              <Plus className="w-4 h-4" /> Benutzer anlegen
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Name oder E-Mail suchen…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="disabled">Deaktiviert</SelectItem>
            <SelectItem value="locked">Gesperrt</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger><SelectValue placeholder="Abteilung" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Abteilungen</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger><SelectValue placeholder="Rolle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Rollen</SelectItem>
            {roles.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
        <Filter className="w-3 h-3" /> Sortierung:
        <button onClick={() => setSortBy('name')} className={`px-2 py-1 rounded ${sortBy === 'name' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>Name</button>
        <button onClick={() => setSortBy('created')} className={`px-2 py-1 rounded ${sortBy === 'created' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>Erstellungsdatum</button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Name</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">E-Mail</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Abteilung</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Rollen</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Einladung</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden xl:table-cell">Erstellt</th>
                {isAdmin && <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktionen</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Keine Benutzer gefunden</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => loadUserDetail(u)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {(u.full_name || '?')[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{u.full_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{u.departments?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roleNames.length > 0 ? u.roleNames.map(r => (
                          <span key={r} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                            <Shield className="w-3 h-3" />{r}
                          </span>
                        )) : <span className="text-muted-foreground text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(u.account_status)}`}>
                        {u.account_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${invitationBadge(u.invitation_status)}`}>
                        {u.invitation_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">{fmt(u.created_at)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSendInvitation(u)} title="Einladung senden">
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditRoles(u)} title="Rollen bearbeiten">
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /> Benutzer anlegen</DialogTitle>
            <DialogDescription>Neuen Benutzer über sichere Server-Funktion erstellen</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input value={createForm.full_name} onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <Label>E-Mail *</Label>
                <Input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Passwort (optional)</Label>
                <Input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Auto-generiert wenn leer" />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input value={createForm.phone_number} onChange={e => setCreateForm(f => ({ ...f, phone_number: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Abteilung</Label>
                <Select value={createForm.department_id} onValueChange={v => setCreateForm(f => ({ ...f, department_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>OTP-Kanal</Label>
                <Select value={createForm.otp_channel} onValueChange={v => setCreateForm(f => ({ ...f, otp_channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">E-Mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Rollen</Label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map(r => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-secondary/50 transition-colors">
                    <Checkbox
                      checked={createForm.role_ids.includes(r.id)}
                      onCheckedChange={(checked) => {
                        setCreateForm(f => ({
                          ...f,
                          role_ids: checked
                            ? [...f.role_ids, r.id]
                            : f.role_ids.filter(id => id !== r.id),
                        }));
                      }}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={creating} className="gold-gradient text-primary-foreground">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Roles Dialog */}
      <Dialog open={showEditRoles} onOpenChange={setShowEditRoles}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rollen & Abteilung bearbeiten</DialogTitle>
            <DialogDescription>{selectedUser?.full_name} ({selectedUser?.email})</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">Abteilung</Label>
              <Select value={editDeptId} onValueChange={setEditDeptId}>
                <SelectTrigger><SelectValue placeholder="Keine Abteilung" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Abteilung</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Rollen</Label>
              <div className="space-y-1">
                {roles.map(r => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-secondary/50 transition-colors">
                    <Checkbox
                      checked={editRoleIds.includes(r.id)}
                      onCheckedChange={(checked) => {
                        setEditRoleIds(prev => checked ? [...prev, r.id] : prev.filter(id => id !== r.id));
                      }}
                    />
                    {r.name}
                    {r.description && <span className="text-xs text-muted-foreground ml-1">— {r.description}</span>}
                  </label>
                ))}
              </div>
            </div>
            {(() => {
              const lieferantRoleId = roles.find(r => r.name === 'Lieferant')?.id;
              const isLieferant = lieferantRoleId ? editRoleIds.includes(lieferantRoleId) : false;
              if (!isLieferant) return null;
              return (
                <div>
                  <Label className="mb-2 block">Lieferant zuordnen <span className="text-destructive">*</span></Label>
                  <Select value={editSupplierId} onValueChange={setEditSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Lieferant wählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Kein Lieferant —</SelectItem>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Der Benutzer sieht nur Production Orders dieses Lieferanten.
                  </p>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRoles(false)}>Abbrechen</Button>
            <Button onClick={handleSaveRoles} disabled={savingRoles}>
              {savingRoles && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
