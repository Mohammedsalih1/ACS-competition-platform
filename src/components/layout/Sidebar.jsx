import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FileCheck2, FolderKanban, Gavel, LayoutDashboard, LogOut, Settings, Upload, Users, X, Workflow } from 'lucide-react';
import acsLogo from '../../assets/acs-logo.png';

const navigation = {
  admin: [
    { label: 'Administration', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Users', to: '/admin/users', icon: Users },
    { label: 'Projects', to: '/admin/projects', icon: FolderKanban },
    { label: 'Competition Stages', to: '/admin/stages', icon: Workflow },
    { label: 'Judging Settings', to: '/admin/settings', icon: Settings },
  ],
  judge: [
    { label: 'Judge Dashboard', to: '/judge', icon: LayoutDashboard, end: true },
    { label: 'Open Projects', to: '/judge/projects', icon: Gavel },
    { label: 'My Evaluations', to: '/judge/evaluations', icon: FileCheck2 },
  ],
  contestant: [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, end: true },
    { label: 'Submit Project', to: '/dashboard/submit', icon: Upload },
  ],
};

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const items = navigation[user?.role] ?? [];

  return (
    <>
      <button type="button" aria-label="Close navigation" onClick={onClose} className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gradient-to-b from-acs-purple-dark to-acs-purple text-white shadow-2xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <img src={acsLogo} alt="ACS" className="h-10 max-w-[170px] object-contain" />
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acs-orange lg:hidden" aria-label="Close navigation"><X className="h-5 w-5" /></button>
        </div>
        <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Main menu</p>
          <div className="space-y-1">
            {items.map(({ label, to, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={onClose} className={({ isActive }) => [
                'flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acs-orange focus-visible:ring-offset-2 focus-visible:ring-offset-acs-purple',
                isActive ? 'border-white/10 bg-white/14 text-white shadow-sm' : 'text-white/68 hover:bg-white/9 hover:text-white',
              ].join(' ')}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9"><AvatarFallback className="bg-acs-orange text-sm font-bold text-white">{user?.name?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.name}</p><Badge variant="outline" className="mt-1 border-white/20 text-[10px] uppercase text-white/70">{user?.role}</Badge></div>
            <button type="button" onClick={logout} className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acs-orange" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
