import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, History, LockKeyhole, Scale } from 'lucide-react';

export default function JudgingSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [count, setCount] = useState(3);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { api('/judging/settings').then((data) => { setSettings(data.settings); setCount(data.settings.requiredEvaluations); }); }, []);
  const save = async () => {
    try {
      const data = await api('/judging/settings', { method: 'PATCH', body: JSON.stringify({ requiredEvaluations: Number(count), reason }) });
      setSettings(data.settings); setReason(''); setMessage('Judging settings updated.');
    } catch (error) { setMessage(error.message); }
  };
  return <div className="max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header><p className="text-xs font-bold uppercase tracking-[.18em] text-acs-orange-dark">Competition controls</p><h2 className="mt-2 text-3xl font-bold text-primary">Judging settings</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Set the completion threshold while preserving fairness, auditability, and completed judging records.</p></header>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
      <Card className="shadow-sm"><CardHeader><CardTitle>Required final evaluations</CardTitle></CardHeader><CardContent className="space-y-5"><label className="block text-sm font-semibold">Evaluations per project<input type="number" min="1" max="20" value={count} onChange={(event) => setCount(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-lg font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label><label className="block text-sm font-semibold">Documented change reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-28 w-full resize-y rounded-xl border border-input bg-background p-3 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="Required once judging has started" /></label>{message && <p role="status" className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{message}</p>}<Button onClick={save} className="min-w-36">Save settings</Button></CardContent></Card>
      <Card className="border-primary/10 bg-gradient-to-br from-primary/[.055] to-white shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-acs-orange" />Policy safeguards</CardTitle></CardHeader><CardContent className="space-y-5"><Policy icon={LockKeyhole} title="Completed records are protected" text="The threshold cannot be reduced below an existing project's final evaluation count." /><Policy icon={History} title="Every change is auditable" text="Once judging starts, the administrator must record a reason and actor." /><Policy icon={CheckCircle2} title="Approval remains separate" text="Meeting the threshold does not publish a result; explicit administrative approval is still required." /></CardContent></Card>
    </div>
    <Card className="shadow-sm"><CardHeader><CardTitle>Configuration history</CardTitle></CardHeader><CardContent>{settings?.history?.length ? <div className="divide-y divide-border">{[...settings.history].reverse().map((item, index) => <div key={`${item.changedAt}-${index}`} className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[180px_1fr]"><p className="font-semibold text-primary">{item.from} → {item.to} evaluations</p><div><p className="text-sm">{item.reason || 'Initial configuration'}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.changedAt).toLocaleString()} · {item.changedBy?.name || 'Administrator'}</p></div></div>)}</div> : <div className="flex flex-col items-center py-8 text-center"><History className="h-8 w-8 text-muted-foreground/45" /><p className="mt-3 font-medium">No configuration changes yet</p><p className="mt-1 text-sm text-muted-foreground">The initial threshold is active. Future changes will appear here.</p></div>}</CardContent></Card>
  </div>;
}

function Policy({ icon: Icon, title, text }) { return <div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-primary">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></div>; }
