import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { login } from '../../api/endpoints/auth';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getSession, useSession } from '../../lib/session';
import { AuthShell } from './AuthShell';

/** Only same-site paths are followed after signing in. */
const safeNext = (value: string | null): string | null => (value && value.startsWith('/') && !value.startsWith('//') ? value : null);

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const session = useSession();

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Someone who is already signed in has nothing to do here.
  useEffect(() => {
    if (session?.kind === 'customer') navigate(next ?? (session.isAdmin ? '/admin' : '/mis-ordenes'), { replace: true });
  }, [session, next, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login({ correo: correo.trim(), contrasena: password });
      const fresh = getSession();
      navigate(next ?? (fresh?.isAdmin ? '/admin' : '/mis-ordenes'), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title="Iniciar sesión" subtitle="Accede a tus viajes y a tus datos guardados.">
      {error != null && <ProblemAlert error={error} title="No pudimos iniciar tu sesión" className="mb-6" />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="nombre@ejemplo.com"
          leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
        />

        <Input
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-black"
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        </button>

        <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full gap-2 font-bold">
          <span>Ingresar</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
        <p>
          ¿Aún no tienes cuenta?{' '}
          <Link to={`/registro${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-brand-gold-dark hover:underline">
            Crear cuenta
          </Link>
        </p>
        <p>
          ¿Compraste como invitado?{' '}
          <Link to="/recuperar-orden" className="font-bold text-brand-gold-dark hover:underline">
            Consulta tu viaje con tu código de reserva
          </Link>
        </p>
      </div>
    </AuthShell>
  );
};
