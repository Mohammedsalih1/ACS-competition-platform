import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, Trophy, Upload } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/submissions/mine?limit=20')
      .then((data) => setSubmissions(data.submissions))
      .catch((err) => setError(err.message || 'Could not load submissions.'))
      .finally(() => setLoading(false));
  }, []);

  const latest = submissions[0];
  const stats = [
    { icon: FileText, label: 'Total Submissions', value: String(submissions.length) },
    { icon: Clock, label: 'Current Status', value: latest?.status?.replace('_', ' ') || 'Not submitted' },
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
          <CardTitle className="text-lg">Your Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="py-8 text-sm text-destructive">{error}</p> : loading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading submissions…</p>
          ) : submissions.length ? (
            <div className="divide-y divide-border">
              {submissions.map((submission) => (
                <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-foreground">{submission.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString() : 'Draft'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-primary">{submission.stageParticipation?.stage?.name || 'Stage assignment pending'}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{submission.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
          ) : <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="font-medium text-muted-foreground">No submissions yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Add your project information and ZIP file to submit
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate('/dashboard/submit')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Submit Project
            </Button>
          </div>}
        </CardContent>
      </Card>
    </div>
  );
}
