import { useAuth } from '../../hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 fixed top-0 left-64 right-0 z-10">
      <h1 className="font-semibold text-foreground text-lg">Dashboard</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user?.name}</span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
