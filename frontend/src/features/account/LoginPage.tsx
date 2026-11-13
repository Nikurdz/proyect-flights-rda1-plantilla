import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { login } from '../../api/endpoints/auth';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getSession, useSession } from '../../lib/session';
import { AuthShell } from './AuthShell';

/** Only same-site paths are followed after signing in. */
const safeNext = (value: string | null): string | null => (value && value.startsWith('/') && !value.startsWith('//') ? value : null);

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const link = 'font-medium text-gold-text underline underline-offset-2 hover:text-ink';

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
  const [fieldErrors, setFieldErrors] = useState<{ correo?: string; password?: string }>({});

  // Someone who is already signed in has nothing to do here.
  useEffect(() => {
    if (session?.kind === 'customer') navigate(next ?? (session.isAdmin ? '/admin' : '/mis-ordenes'), { replace: true });
  }, [session, next, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const errors: { correo?: string; password?: string } = {};
    if (!correo.trim()) errors.correo = 'Escribe tu correo electrónico.';
    else if (!EMAIL_SHAPE.test(correo.trim())) errors.correo = 'Revisa tu correo: debe parecerse a nombre@ejemplo.com.';
    if (!password) errors.password = 'Escribe tu contraseña.';
    setFieldErrors(errors);
    if (errors.correo || errors.password) {
      // The focus goes to the first field with a problem once React has drawn the messages.
      window.setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

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
    <AuthShell title="Iniciar sesión" subtitle="Entra para ver tus viajes y comprar con tus datos guardados.">
      {error != null && <ProblemAlert error={error} title="No pudimos iniciar tu sesión" className="mb-6" />}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="nombre@ejemplo.com"
          leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
          value={correo}
          error={fieldErrors.correo}
          onChange={(e) => {
            setCorreo(e.target.value);
            if (fieldErrors.correo) setFieldErrors((prev) => ({ ...prev, correo: undefined }));
          }}
        />

        <Input
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
          value={password}
          error={fieldErrors.password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
        />

        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-small font-medium text-muted hover:text-ink"
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        </button>

        <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
          Iniciar sesión
        </Button>
      </form>

      <div className="mt-6 space-y-2 border-t border-line pt-5 text-small text-muted">
        <p>
          ¿Aún no tienes cuenta?{' '}
          <Link to={`/registro${next ? `?next=${encodeURIComponent(next)}` : ''}`} className={link}>
            Crear cuenta
          </Link>
        </p>
        <p>
          ¿Compraste como invitado?{' '}
          <Link to="/recuperar-orden" className={link}>
            Consulta tu viaje con tu código de reserva
          </Link>
        </p>
        <p>
          ¿Necesitas ayuda?{' '}
          <Link to="/ayuda#cuenta" className={link}>
            Mira las preguntas sobre tu cuenta
          </Link>
        </p>
      </div>
    </AuthShell>
  );
};
