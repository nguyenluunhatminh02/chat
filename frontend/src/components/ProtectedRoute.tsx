import { Navigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUserId } = useAppContext();
  
  if (!currentUserId) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}