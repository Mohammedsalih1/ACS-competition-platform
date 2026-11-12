import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, ClipboardClock, FolderKanban, Gavel, Users } from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api('/users/stats'),
      api('/results/stats'),
      api('/submissions?limit=6&sort=-createdAt'),
    ]).then(([users, results, recent]) => setData({ users: users.stats, results: results.stats, recent: recent.submissions }))
      .catch((err) => setError(err.message || 'Could not load administration data.'));
  }, []);

  if (error) return <StateMessage title="Dashboard unavailable" message={error} error />;
  if (!data) return <StateMessage title="Loading administration dashboard" message="Collecting current competition metrics…" />;

  const { users, results, recent } = data;
  const stats = [
    { label: 'Contestants', value: users.byRole.contestant, icon: Users },
    { label: 'Judges', value: users.byRole.judge, icon: Gavel },
    { label: 'Submitted projects', value: results.submissions.total - results.submissions.byStatus.draft, icon: FolderKanban },
    { label: 'Awaiting evaluation', value: results.submissions.pendingEvaluation, icon: ClipboardClock },
    { label: 'Fully evaluated', value: results.submissions.fullyEvaluated, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div><p className="text-sm font-medium text-acs-orange">Operations overview</p><h2 className="mt-1 text-3xl font-bold text-primary">Administration</h2><p className="mt-2 text-sm text-muted-foreground">Live account, submission, and evaluation activity.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="p-5"><Icon className="h-5 w-5 text-acs-orange" /><p className="mt-4 text-3xl font-bold text-primary">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Recent submissions</CardTitle><Link className="text-sm font-medium text-primary hover:underline" to="/admin/projects">View all</Link></CardHeader><CardContent>
          {recent.length ? <div className="divide-y divide-border">{recent.map((project) => <Link key={project.id} to={`/admin/projects/${project.id}`} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 hover:text-primary"><div className="min-w-0"><p className="truncate font-medium">{project.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{project.contestant?.name || 'Unknown contestant'} · {formatDate(project.submittedAt || project.createdAt)}</p></div><Badge variant="outline" className="capitalize">{project.status.replace('_', ' ')}</Badge></Link>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">No submissions yet.</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Evaluation progress</CardTitle></CardHeader><CardContent className="space-y-5"><div><div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">Final evaluation capacity</span><span className="font-semibold">{results.evaluations.progressPercent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-acs-orange" style={{ width: `${results.evaluations.progressPercent}%` }} /></div></div><Metric label="Required per project" value={results.evaluations.requiredPerProject} /><Metric label="Completed evaluations" value={results.evaluations.total} /><Metric label="Draft evaluations" value={results.evaluations.drafts} /><Metric label="Results status" value={results.published ? 'Published' : 'Private'} /></CardContent></Card>
      </div>
    </div>
  );
}

const Metric = ({ label, value }) => <div className="flex items-center justify-between border-b border-border pb-3 text-sm last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="font-semibold text-foreground">{value}</span></div>;
const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)) : 'Not submitted';
function StateMessage({ title, message, error = false }) { return <div className="p-8"><Card><CardContent className="flex items-start gap-3 p-6">{error && <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />}<div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{message}</p></div></CardContent></Card></div>; }
