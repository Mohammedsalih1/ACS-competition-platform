import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import SubmissionStatus from '../components/submission/SubmissionStatus';
import {
  FileArchive, ExternalLink, Calendar, Clock,
  Upload, AlertCircle, FileText, RefreshCw
} from 'lucide-react';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MySubmissionPage() {
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSubmission = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/submissions/mine');
      // Get the most recent submission
      const submissions = data.submissions ?? [];
      setSubmission(submissions.length > 0 ? submissions[0] : null);
    } catch (err) {
      setError('Failed to load your submission. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmission();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-3xl animate-in fade-in duration-300">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 max-w-3xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={fetchSubmission}>
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No submission yet
  if (!submission) {
    return (
      <div className="p-8 max-w-3xl animate-in fade-in duration-300">
        <h1 className="text-3xl font-bold text-primary mb-2">My Submission</h1>
        <p className="text-muted-foreground mb-8">Track your project submission status</p>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-14 w-14 text-muted-foreground/25 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-1">No submission yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You have not submitted a project yet. Start by uploading your project.
            </p>
            <Button onClick={() => navigate('/dashboard/submit')}>
              <Upload className="h-4 w-4 mr-2" />
              Submit Project
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Has submission
  const latestFile = submission.files?.filter(f => f.status === 'uploaded').at(-1)
    ?? submission.files?.at(-1);

  return (
    <div className="p-8 space-y-6 max-w-3xl animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">{submission.title}</h1>
          <p className="text-muted-foreground mt-1">Your project submission</p>
        </div>
        <SubmissionStatus status={submission.status} />
      </div>

      {/* Project Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Description */}
          {submission.description && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-foreground">{submission.description}</p>
            </div>
          )}

          {/* Live URL */}
          {submission.liveUrl && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Live URL</p>
              <a
                href={submission.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary flex items-center gap-1.5 hover:underline w-fit"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {submission.liveUrl}
              </a>
            </div>
          )}

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Submitted At</p>
                <p className="text-sm font-medium">{formatDate(submission.submittedAt)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm font-medium">{formatDate(submission.updatedAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Uploaded File</CardTitle>
        </CardHeader>
        <CardContent>
          {latestFile ? (
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40 border border-border">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileArchive className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {latestFile.originalFileName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatSize(latestFile.size)} · Uploaded {formatDate(latestFile.createdAt)}
                </p>
              </div>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 shrink-0">
                Uploaded
              </Badge>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileArchive className="h-10 w-10 text-muted-foreground/25 mb-2" />
              <p className="text-sm text-muted-foreground">No file uploaded yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Timeline Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { key: 'draft',        label: 'Draft Created',    desc: 'Submission record created' },
              { key: 'submitted',    label: 'Submitted',        desc: 'Project uploaded and submitted for review' },
              { key: 'under_review', label: 'Under Review',     desc: 'Judges are reviewing your project' },
              { key: 'scored',       label: 'Scored',           desc: 'Your project has been evaluated' },
            ].map((step, index, arr) => {
              const statuses = ['draft', 'submitted', 'under_review', 'scored'];
              const currentIndex = statuses.indexOf(submission.status);
              const stepIndex = statuses.indexOf(step.key);
              const isDone = stepIndex <= currentIndex;
              const isCurrent = step.key === submission.status;

              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0
                      ${isCurrent ? 'bg-primary border-primary text-white'
                        : isDone ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'bg-muted border-border text-muted-foreground'}`}>
                      {index + 1}
                    </div>
                    {index < arr.length - 1 && (
                      <div className={`w-0.5 h-6 mt-1 ${isDone ? 'bg-primary/30' : 'bg-border'}`} />
                    )}
                  </div>
                  <div className="pt-0.5 pb-4">
                    <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchSubmission}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
      </div>
    </div>
  );
}