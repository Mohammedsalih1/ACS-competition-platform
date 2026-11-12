import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Pencil, Plus, RefreshCw, ShieldCheck, UserCheck, UserX, X } from 'lucide-react';

const emptyForm = { name: '', email: '', password: '', role: 'contestant', isActive: true };

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ search: '', role: '', isActive: '', page: 1 });
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    const query = new URLSearchParams({ page: String(filters.page), limit: '15' });
    if (filters.search) query.set('search', filters.search);
    if (filters.role) query.set('role', filters.role);
    if (filters.isActive) query.set('isActive', filters.isActive);
    try {
      const [list, summary] = await Promise.all([api(`/users?${query}`), api('/users/stats')]);
      setUsers(list.users); setMeta(list.meta); setStats(summary.stats);
    } catch (err) { setError(err.message || 'Could not load users.'); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm); setDialog({ type: 'create' }); setError(''); };
  const openEdit = (account) => { setForm({ name: account.name, email: account.email, role: account.role, isActive: account.isActive, password: '' }); setDialog({ type: 'edit', account }); setError(''); };
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (dialog.type === 'create') {
        await api('/users', { method: 'POST', body: JSON.stringify(form) });
        setNotice('Account created successfully.');
      } else {
        const roleChanged = form.role !== dialog.account.role;
        if (roleChanged && !window.confirm(`Change this account's role to ${form.role}?`)) return;
        await api(`/users/${dialog.account.id}`, { method: 'PATCH', body: JSON.stringify({ name: form.name, email: form.email, role: form.role }) });
        setNotice('Account updated successfully.');
      }
      setDialog(null); await load();
    } catch (err) { setError(err.message || 'Could not save account.'); }
    finally { setBusy(false); }
  };
  const toggleStatus = async (account) => {
    const next = !account.isActive;
    if (!window.confirm(`${next ? 'Activate' : 'Disable'} ${account.name}'s account?`)) return;
    try { await api(`/users/${account.id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) }); setNotice(`Account ${next ? 'activated' : 'disabled'}.`); await load(); } catch (err) { setError(err.message); }
  };
  const resetPassword = async (account) => {
    const value = window.prompt(`Enter a temporary password for ${account.name} (minimum 8 characters with upper, lower, number, and symbol):`);
    if (!value) return;
    if (!window.confirm('Resetting credentials will sign this user out on every device. Continue?')) return;
    try { await api(`/users/${account.id}/password`, { method: 'PATCH', body: JSON.stringify({ newPassword: value }) }); setNotice('Password reset and active sessions revoked.'); } catch (err) { setError(err.message); }
  };

  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-acs-orange">Accounts and access</p><h2 className="mt-1 text-3xl font-bold text-primary">Users</h2><p className="mt-2 text-sm text-muted-foreground">Provision accounts, assign roles, and control access.</p></div><Button size="lg" onClick={openCreate}><Plus />Create user</Button></div>
    {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}{notice && <Alert><ShieldCheck className="text-green-600" /><AlertDescription>{notice}</AlertDescription></Alert>}
    {stats && <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">{[['Total', stats.total], ['Admins', stats.byRole.admin], ['Judges', stats.byRole.judge], ['Contestants', stats.byRole.contestant], ['Active', stats.active], ['Disabled', stats.disabled]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-2xl font-bold text-primary">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>)}</div>}
    <Card><CardHeader><CardTitle>User directory</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]"><Input aria-label="Search users" placeholder="Search name or email" value={filters.search} onChange={(e) => setFilters((v) => ({ ...v, search: e.target.value, page: 1 }))} /><Select value={filters.role} onChange={(e) => setFilters((v) => ({ ...v, role: e.target.value, page: 1 }))}><option value="">All roles</option><option value="admin">Administrators</option><option value="judge">Judges</option><option value="contestant">Contestants</option></Select><Select value={filters.isActive} onChange={(e) => setFilters((v) => ({ ...v, isActive: e.target.value, page: 1 }))}><option value="">All statuses</option><option value="true">Active</option><option value="false">Disabled</option></Select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr><th className="py-3 pr-4">Account</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="py-3 pl-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border">{users.map((account) => <tr key={account.id}><td className="py-4 pr-4"><p className="font-medium">{account.name}</p><p className="text-xs text-muted-foreground">{account.email}</p></td><td className="px-4 py-4"><Badge variant="outline" className="capitalize">{account.role}</Badge></td><td className="px-4 py-4"><Badge variant={account.isActive ? 'default' : 'destructive'}>{account.isActive ? 'Active' : 'Disabled'}</Badge></td><td className="px-4 py-4 text-muted-foreground">{new Date(account.createdAt).toLocaleDateString()}</td><td className="py-4 pl-4"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(account)} aria-label={`Edit ${account.name}`}><Pencil /></Button><Button variant="ghost" size="icon" onClick={() => resetPassword(account)} aria-label={`Reset ${account.name} password`}><RefreshCw /></Button><Button variant="ghost" size="icon" disabled={account.id === currentUser.id} onClick={() => toggleStatus(account)} aria-label={`${account.isActive ? 'Disable' : 'Activate'} ${account.name}`}>{account.isActive ? <UserX /> : <UserCheck />}</Button></div></td></tr>)}</tbody></table>{!users.length && <p className="py-10 text-center text-sm text-muted-foreground">No users match these filters.</p>}</div>
      {meta && <div className="flex items-center justify-between border-t border-border pt-4 text-sm"><span className="text-muted-foreground">{meta.total} accounts · Page {meta.page} of {meta.totalPages}</span><div className="flex gap-2"><Button variant="outline" disabled={!meta.hasPrevPage} onClick={() => setFilters((v) => ({ ...v, page: v.page - 1 }))}>Previous</Button><Button variant="outline" disabled={!meta.hasNextPage} onClick={() => setFilters((v) => ({ ...v, page: v.page + 1 }))}>Next</Button></div></div>}
    </CardContent></Card>
    {dialog && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><Card className="w-full max-w-lg"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>{dialog.type === 'create' ? 'Create account' : 'Edit account'}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Only administrators can assign roles.</p></div><Button variant="ghost" size="icon" onClick={() => setDialog(null)} aria-label="Close"><X /></Button></CardHeader><CardContent><form onSubmit={save} className="space-y-4"><Field label="Full name"><Input required minLength={2} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></Field><Field label="Email"><Input required type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} /></Field>{dialog.type === 'create' && <Field label="Temporary password"><Input required type="password" minLength={8} value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} /><p className="mt-1 text-xs text-muted-foreground">Use upper/lowercase letters, a number, and a symbol.</p></Field>}<Field label="Role"><Select value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}><option value="contestant">Contestant</option><option value="judge">Judge</option><option value="admin">Administrator</option></Select></Field>{dialog.type === 'create' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((v) => ({ ...v, isActive: e.target.checked }))} />Activate account immediately</label>}<div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save account'}</Button></div></form></CardContent></Card></div>}
  </div>;
}

const Select = (props) => <select {...props} className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />;
const Field = ({ label, children }) => <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span>{children}</label>;
