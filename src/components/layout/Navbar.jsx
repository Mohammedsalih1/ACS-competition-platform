import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Menu } from 'lucide-react';

const titleForPath = (pathname) => {
  if (pathname.startsWith('/admin/users')) return 'User Administration';
  if (pathname.startsWith('/admin/projects')) return 'Project Administration';
  if (pathname.startsWith('/admin/stages')) return 'Competition Stages';
  if (pathname.startsWith('/admin/settings')) return 'Judging Settings';
  if (pathname.startsWith('/admin')) return 'Administration Dashboard';
  if (pathname.includes('/workspace')) return 'Code Review Workspace';
  if (pathname.includes('/evaluate')) return 'Project Evaluation';
  if (pathname.startsWith('/judge/evaluations')) return 'My Evaluations';
  if (pathname.startsWith('/judge/projects')) return 'Open Projects';
  if (pathname.startsWith('/judge')) return 'Judge Dashboard';
  if (pathname.includes('/submit')) return 'Submit Project';
  return 'Contestant Dashboard';
};

export default function Navbar({ onMenuClick }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const title = titleForPath(pathname);
  useEffect(() => { document.title = `${title} · ACS Competition`; }, [title]);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/80 bg-white/85 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMenuClick} className="rounded-lg border border-border p-2 text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
        <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{title}</h1>
      </div>
      <div className="flex items-center gap-3"><span className="hidden text-sm text-muted-foreground sm:block">{user?.name}</span><Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">{user?.name?.[0]?.toUpperCase()}</AvatarFallback></Avatar></div>
    </header>
  );
}
