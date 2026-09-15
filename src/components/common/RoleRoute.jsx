import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingScreen from './LoadingScreen';

// Role guard: redirects users to /forbidden when their role does not match.
export default function RoleRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/forbidden" replace />;

  return children;
}
