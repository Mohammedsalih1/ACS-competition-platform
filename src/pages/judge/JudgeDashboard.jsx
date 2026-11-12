import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, CheckCircle2, FilePenLine, FolderOpen, Trophy } from 'lucide-react';

export default function JudgeDashboard() {
  const [dashboard, setDashboard] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api('/judging/dashboard').then((data) => setDashboard(data.dashboard)).catch((err) => setError(err.message)); }, []);
  const cards = dashboard && [['Open projects', dashboard.availableProjects, FolderOpen], ['My final evaluations', dashboard.submittedEvaluations, CheckCircle2], ['Drafts in progress', dashboard.draftEvaluations, FilePenLine], ['Projects complete', dashboard.requirementsMet, Trophy]];
  return <div className="space-y-8 p-4 sm:p-6 lg:p-8"><section className="overflow-hidden rounded-3xl bg-gradient-to-br from-acs-purple-dark via-acs-purple to-acs-purple-light p-7 text-white shadow-xl sm:p-10"><p className="text-xs font-bold uppercase tracking-[.2em] text-acs-orange">ACS open judging</p><h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Evaluate excellent work with clarity and consistency.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Every eligible project is available to every judge until it receives {dashboard?.requiredEvaluations ?? 3} final evaluations.</p><Link to="/judge/projects" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-acs-orange px-5 py-3 text-sm font-bold text-acs-purple-dark transition hover:bg-acs-orange-light">Browse open projects <ArrowRight className="h-4 w-4" /></Link></section>{error && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards?.map(([label, value, Icon]) => <Card key={label}><CardContent className="p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary"><Icon className="h-5 w-5" /></div><p className="mt-5 text-3xl font-bold text-primary">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>) || <p className="text-sm text-muted-foreground">Loading judging activity…</p>}</section></div>;
}
