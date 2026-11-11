import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../lib/session';

/**
 * Route guards decide what to show, not what is allowed: the API checks every request and is the
 * real gate. They keep people from landing on screens that could only answer 401/403.
 */
export const RequireCustomer: React.FC = () => {
  const session = useSession();
  const location = useLocation();
  if (session?.kind !== 'customer') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <Outlet />;
};

export const RequireAdmin: React.FC = () => {
  const session = useSession();
  const location = useLocation();
  if (session?.kind !== 'customer') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (!session.isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
};
