import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useSession } from '../lib/session';
import { endSession } from '../lib/auth-actions';
import { Button } from '../components/ui/Button';
import { ButtonLink } from '../components/ui/ButtonLink';
import { EmptyState } from '../components/ui/EmptyState';

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

/** What a signed-in person without the administrator role sees: why, and where to go next. */
export const AdminOnlyNotice: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const signInWithAnotherAccount = () => {
    const next = encodeURIComponent(location.pathname + location.search);
    endSession();
    navigate(`/login?next=${next}`);
  };

  return (
    <div className="bg-paper px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-xl rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<ShieldAlert />}
          title="Esta sección es solo para administradores"
          description="Tu cuenta no tiene permiso para ver esta página. Si crees que debería tenerlo, pídelo a un administrador o entra con otra cuenta."
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/" variant="primary">
                Volver al inicio
              </ButtonLink>
              <Button type="button" variant="outline" onClick={signInWithAnotherAccount}>
                Iniciar sesión con otra cuenta
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
};

export const RequireAdmin: React.FC = () => {
  const session = useSession();
  const location = useLocation();
  if (session?.kind !== 'customer') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (!session.isAdmin) return <AdminOnlyNotice />;
  return <Outlet />;
};
