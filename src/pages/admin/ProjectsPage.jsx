import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, FileArchive, FolderKanban } from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [stages, setStages] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', hasAttachment: '', stage: '', sort: '-submittedAt', page: 1 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const query = new URLSearchParams({ page: String(filters.page), limit: '15', sort: filters.sort });
    for (const key of ['search', 'status', 'hasAttachment', 'stage']) if (filters[key]) query.set(key, filters[key]);
    try { const result = await api(`/submissions?${query}`); setProjects(result.submissions); setMeta(result.meta); }
    catch (err) { setError(err.message || 'Could not load projects.'); }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api('/stages').then((data) => setStages(data.stages || [])).catch(() => {}); }, []);

  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <div><p className="text-sm font-medium text-acs-orange">Competition data</p><h2 className="mt-1 text-3xl font-bold text-primary">Projects</h2><p className="mt-2 text-sm text-muted-foreground">Review submission metadata, attachments, evaluation progress, and approval state.</p></div>
    <div className="max-w-sm"><Select aria-label="Filter by competition stage" value={filters.stage} onChange={(e) => setFilters((v) => ({ ...v, stage: e.target.value, page: 1 }))}><option value="">All competition stages</option>{stages.map((stage) => <option key={stage.id || stage._id} value={stage.id || stage._id}>{stage.name}</option>)}</Select></div>
    {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
    <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Project directory</CardTitle>{meta && <Badge variant="outline">{meta.total} records</Badge>}</CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_200px]"><Input placeholder="Search project title" aria-label="Search projects" value={filters.search} onChange={(e) => setFilters((v) => ({ ...v, search: e.target.value, page: 1 }))} /><Select value={filters.status} onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value, page: 1 }))}><option value="">All statuses</option><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="scored">Scored</option></Select><Select value={filters.hasAttachment} onChange={(e) => setFilters((v) => ({ ...v, hasAttachment: e.target.value, page: 1 }))}><option value="">Any attachment</option><option value="true">Has ZIP</option><option value="false">No ZIP</option></Select><Select value={filters.sort} onChange={(e) => setFilters((v) => ({ ...v, sort: e.target.value, page: 1 }))}><option value="-submittedAt">Newest submitted</option><option value="submittedAt">Oldest submitted</option><option value="title">Title A–Z</option><option value="-title">Title Z–A</option><option value="-createdAt">Newest created</option></Select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr><th className="py-3 pr-4">Project</th><th className="px-4 py-3">Contestant</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Attachment</th><th className="px-4 py-3">Judges</th><th className="py-3 pl-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-border">{projects.map((project) => <tr key={project.id}><td className="py-4 pr-4"><p className="font-medium">{project.title}</p><p className="mt-1 text-xs text-muted-foreground">{project.evaluationCount} evaluation{project.evaluationCount === 1 ? '' : 's'}</p></td><td className="px-4 py-4"><p>{project.contestant?.name || 'Unknown'}</p><p className="text-xs text-muted-foreground">{project.contestant?.email}</p></td><td className="px-4 py-4 text-muted-foreground">{formatDate(project.submittedAt)}</td><td className="px-4 py-4"><Status value={project.status} /></td><td className="px-4 py-4">{project.hasAttachment ? <span className="inline-flex items-center gap-1 text-green-700"><FileArchive className="h-4 w-4" />Available</span> : <span className="text-muted-foreground">Missing</span>}</td><td className="px-4 py-4">{project.assignedJudges?.length ? project.assignedJudges.map((judge) => judge.name).join(', ') : <span className="text-acs-orange-dark">Unassigned</span>}</td><td className="py-4 pl-4 text-right"><Button variant="outline" render={<Link to={`/admin/projects/${project.id}`} />}>Details</Button></td></tr>)}</tbody></table>{!loading && !projects.length && <div className="flex flex-col items-center py-12 text-center"><FolderKanban className="h-10 w-10 text-muted-foreground/40" /><p className="mt-3 font-medium">No matching projects</p><p className="mt-1 text-sm text-muted-foreground">Adjust the search or filters.</p></div>}{loading && <p className="py-10 text-center text-sm text-muted-foreground">Loading projects…</p>}</div>
      {meta && <div className="flex items-center justify-between border-t border-border pt-4 text-sm"><span className="text-muted-foreground">Page {meta.page} of {meta.totalPages}</span><div className="flex gap-2"><Button variant="outline" disabled={!meta.hasPrevPage} onClick={() => setFilters((v) => ({ ...v, page: v.page - 1 }))}>Previous</Button><Button variant="outline" disabled={!meta.hasNextPage} onClick={() => setFilters((v) => ({ ...v, page: v.page + 1 }))}>Next</Button></div></div>}
    </CardContent></Card>
  </div>;
}

const Select = (props) => <select {...props} className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />;
export const Status = ({ value }) => <Badge variant="outline" className="capitalize">{value?.replace('_', ' ')}</Badge>;
export const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)) : 'Not submitted';
