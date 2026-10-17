import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Clock, Trophy, Upload } from 'lucide-react';
import { api } from '../api/client';
import SubmissionStatus from '../components/submission/SubmissionStatus';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loadingSubmission, setLoadingSubmission] = useState(true);

  useEffect(() => {
    api('/submissions/mine')
      .then(data => {
        const submissions = data.submissions ?? [];
        setSubmission(submissions.length > 0 ? submissions[0] : null);
      })
      .catch(() => setSubmission(null))
      .finally(() => setLoadingSubmission(false));
  }, []);

  const stats = [
    { icon: FileText, label: 'Total Submissions', value: loadingSubmission ? '—' : (submission ? '1' : '0') },
    { icon: Clock, label: 'Current Status', value: loadingSubmission ? '—' : (submission?.status ?? 'None') },
    { icon: Trophy, label: 'Competition', value: 'Active' },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <h1 className="text-3xl font-bold text-primary">{user?.name}</h1>
        </div>
        <Badge className="bg-accent/15 text-accent hover:bg-accent/20 border-0 rounded-full px-3">
          {user?.role}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Submission</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSubmission ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : submission ? (
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{submission.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {submission.submittedAt
                      ? `Submitted ${new Date(submission.submittedAt).toLocaleDateString()}`
                      : 'Not submitted yet'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <SubmissionStatus status={submission.status} />
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/submission')}>
                  View Details
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">No submissions yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Upload your project ZIP file and live URL to submit
              </p>
              <Button className="mt-4" onClick={() => navigate('/dashboard/submit')}>
                <Upload className="h-4 w-4 mr-2" />
                Submit Project
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}