import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

interface AdminRouteProps {
  children: React.ReactNode;
}

// UX gate only — ProtectedRoute already blocks rendering until loading is
// false, so isAdmin is safe to use unconditionally here (it's false, not
// undefined, for a logged-out or non-admin user; no window where a null
// user falls through un-redirected). The real security boundary is
// server-side: is_admin(), RLS policies, and every mutating admin RPC's
// own is_admin(auth.uid()) self-check — all untouched by this component.
export function AdminRoute({ children }: AdminRouteProps) {
  const { isAdmin } = useAuth();

  return (
    <ProtectedRoute>
      {isAdmin ? <>{children}</> : <Navigate to="/explore" replace />}
    </ProtectedRoute>
  );
}
