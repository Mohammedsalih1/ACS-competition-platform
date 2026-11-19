import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, downloadFile } from '../../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Download, ExternalLink } from 'lucide-react';

export default function ProjectDetailsPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [evaluationData, setEvaluationData] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(() => Promise.all([
    api(`/submissions/${projectId}`),
    api(`/judging/evaluations/${projectId}`),
  ]).then(([details, evaluations]) => {
    setProject(details.submission);
    setEvaluationData(evaluations);
  }).catch((err) => setMessage(err.message)), [projectId]);

  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!window.confirm('Approve this aggregate result as official?')) return;
    try {
      await api(`/judging/evaluations/${projectId}/approve`, { method: 'POST' });
      setMessage('Result approved.');
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (!project) return <p className="p-8 text-sm text-muted-foreground">{message || 'Loading project…'}</p>;

  const summary = evaluationData?.summary;
  const uploadedFile = project.files?.reduce((latest, file) => (
    !latest || new Date(file.createdAt) > new Date(latest.createdAt) ? file : latest
  ), null);
  const liveHref = project.liveUrl?.startsWith('http://') || project.liveUrl?.startsWith('https://')
    ? project.liveUrl
    : `https://${project.liveUrl}`;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Link to="/admin/projects" className="inline-flex items-center gap-2 text-sm font-medium text-primary">
        <ArrowLeft className="h-4 w-4" />Back to projects
      </Link>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-bold text-primary">{project.title}</h2>
            <Badge variant="outline">{project.reviewState?.replaceAll('_', ' ')}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {project.contestant?.name} · {project.contestant?.email}
          </p>
        </div>
        {(project.liveUrl || project.files?.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {project.liveUrl && (
              <Button
                className="bg-acs-orange hover:bg-acs-orange-dark text-white font-medium shadow-sm"
                render={
                  <a
                    href={liveHref}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <ExternalLink />Live URL
              </Button>
            )}
            {project.files?.length > 0 && (
              <Button variant="outline" onClick={() => downloadFile(`/submissions/${project.id}/download`)}>
                <Download />Download ZIP
              </Button>
            )}
          </div>
        )}
      </header>
      {message && <p className="rounded-xl border bg-white p-4 text-sm">{message}</p>}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader><CardTitle>Submission record</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Info label="Status" value={project.status} />
            <Info label="Submitted" value={formatDate(project.submittedAt)} />
            <Info label="Attachment" value={uploadedFile?.originalFileName || 'No attachment'} />
            <Info label="ZIP uploaded" value={formatDateTime(uploadedFile?.createdAt)} />
            {project.liveUrl && (
              <Info
                label="Live URL"
                value={
                  <a
                    href={liveHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                  >
                    {project.liveUrl}
                    <ExternalLink className="h-3 w-3 inline shrink-0" />
                  </a>
                }
              />
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Description</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {project.description || 'No description provided.'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Official aggregate</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Info label="Final evaluations" value={`${summary?.completed || 0} / ${summary?.required || 3}`} />
            <Info label="Core + bonus average" value={summary?.totalAverage == null ? 'Pending' : Number(summary.totalAverage).toFixed(2)} />
            <Info label="Bonus average" value={summary?.bonusAverage == null ? 'Pending' : Number(summary.bonusAverage).toFixed(2)} />
            {summary?.requirementsMet && !summary.approved && (
              <Button className="w-full" onClick={approve}><CheckCircle2 />Approve official result</Button>
            )}
            {summary?.approved && (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                Approved for publication
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Individual final evaluations</CardTitle></CardHeader>
        <CardContent>
          {evaluationData?.evaluations?.length ? (
            <div className="space-y-4">
              {evaluationData.evaluations.map((evaluation) => (
                <div key={evaluation.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{evaluation.judge?.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(evaluation.submittedAt)}</p>
                    </div>
                    <Badge>{evaluation.totalScore} points</Badge>
                  </div>
                  {evaluation.generalNote && (
                    <p className="mt-3 text-sm text-muted-foreground">{evaluation.generalNote}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No final evaluations yet. Drafts are excluded.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const Info = ({ label, value }) => (
  <div className="flex justify-between gap-4 border-b pb-3 text-sm last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
  : 'Not available';

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Not available';
