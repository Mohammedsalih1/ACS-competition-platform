import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '../hooks/useAuth';

export default function Forbidden() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const home = user?.role === 'admin' ? '/admin' : user?.role === 'judge' ? '/judge' : '/dashboard';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-6xl font-bold text-primary">403</h1>
      <p className="text-xl text-muted-foreground">Access Denied</p>
      <p className="text-center text-muted-foreground">
        You don&apos;t have permission to access this page.
      </p>
      <Button onClick={() => navigate(home)}>Go back</Button>
    </div>
  );
}
