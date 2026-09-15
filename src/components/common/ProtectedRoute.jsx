import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingScreen from './LoadingScreen';

// Guards authenticated routes: show a spinner while booting and redirect
// unauthenticated users to the login page.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
