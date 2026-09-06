import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, LogOut } from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 h-screen bg-primary flex flex-col fixed left-0 top-0">
      <div className="p-5 flex items-center gap-3 border-b border-white/10">
        <img src="/logo-white.png" alt="ACS" className="h-8" />
        <span className="text-white font-bold text-lg">ACS</span>
      </div>

      <nav className="flex-1 p-3 space-y-1 mt-2">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150
             ${isActive
               ? 'bg-white/15 text-white border-l-2 border-accent'
               : 'text-white/70 hover:bg-white/10 hover:text-white'}`
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </NavLink>
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-accent text-white text-sm font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <Badge variant="outline" className="text-accent border-accent/50 text-xs mt-0.5">
              {user?.role}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
