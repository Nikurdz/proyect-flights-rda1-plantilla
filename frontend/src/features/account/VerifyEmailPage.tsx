import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { verificarCorreo } from '../../api/endpoints/auth';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { AuthShell } from './AuthShell';

type State = 'checking' | 'ok' | 'invalid' | 'missing';

/** Target of the link in the verification e-mail: /verificar-correo?token=… */
export const VerifyEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>(token ? 'checking' : 'missing');
  const sent = useRef(false);

  useEffect(() => {
    // StrictMode runs effects twice in development; a token can only be used once.
    if (!token || sent.current) return;
    sent.current = true;
    verificarCorreo(token)
      .then(() => setState('ok'))
      .catch(() => setState('invalid'));
  }, [token]);

  return (
    <AuthShell title="Verificación de correo">
      <div className="text-center" role="status" aria-live="polite">
        {state === 'checking' && (
          <>
            <Loader2 className="mx-auto h-10 w-10 text-gold-text motion-safe:animate-spin" aria-hidden="true" />
            <p className="mt-4 text-body text-muted">Estamos verificando tu correo…</p>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
            <p className="mt-4 text-lead font-semibold text-ink">Tu correo quedó verificado.</p>
            <ButtonLink to="/" variant="accent" className="mt-6">
              Buscar vuelos
            </ButtonLink>
          </>
        )}
        {(state === 'invalid' || state === 'missing') && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />
            <p className="mt-4 text-lead font-semibold text-ink">
              {state === 'missing' ? 'Falta el enlace de verificación.' : 'El enlace no es válido o ya venció.'}
            </p>
            <p className="mt-2 text-small text-muted">Si necesitas un enlace nuevo, mira en Ayuda cómo pedirlo.</p>
            <ButtonLink to="/ayuda#cuenta" variant="outline" className="mt-6">
              Ir a Ayuda
            </ButtonLink>
          </>
        )}
      </div>
    </AuthShell>
  );
};
