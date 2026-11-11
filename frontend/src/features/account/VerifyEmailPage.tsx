import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { verificarCorreo } from '../../api/endpoints/auth';
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
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-gold" aria-hidden="true" />
            <p className="mt-4 text-sm text-slate-600">Estamos verificando tu correo…</p>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
            <p className="mt-4 text-sm font-semibold text-slate-800">¡Listo! Tu correo quedó verificado.</p>
            <Link to="/" className="mt-6 inline-block text-xs font-bold text-brand-gold-dark hover:underline">
              Ir a buscar vuelos
            </Link>
          </>
        )}
        {(state === 'invalid' || state === 'missing') && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-500" aria-hidden="true" />
            <p className="mt-4 text-sm font-semibold text-slate-800">
              {state === 'missing' ? 'Falta el enlace de verificación.' : 'El enlace no es válido o ya venció.'}
            </p>
            <p className="mt-2 text-xs text-slate-500">Si necesitas uno nuevo, contáctanos desde Ayuda.</p>
            <Link to="/ayuda#contacto" className="mt-6 inline-block text-xs font-bold text-brand-gold-dark hover:underline">
              Ir a Ayuda
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
};
