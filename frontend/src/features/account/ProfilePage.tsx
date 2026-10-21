import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, MailWarning } from 'lucide-react';
import { actualizarPreferencias, usePerfil } from '../../api/endpoints/auth';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { useSession } from '../../lib/session';
import { AuthShell } from './AuthShell';

export const ProfilePage: React.FC = () => {
  const session = useSession();
  const queryClient = useQueryClient();
  const { data: perfil, isLoading, error, refetch } = usePerfil(session?.kind === 'customer', session?.ownerId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  const toggleMarketing = async (value: boolean) => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await actualizarPreferencias({ consentimientoMarketing: value });
      queryClient.setQueryData(['perfil-me', session?.ownerId], updated);
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell title="Mi cuenta" subtitle="Tus datos y tus preferencias de comunicación." wide>
      {isLoading && <div role="status" aria-busy="true" aria-label="Cargando"><Skeleton className="h-40 w-full" /></div>}
      {error != null && <ProblemAlert error={error} onRetry={() => refetch()} />}

      {perfil && (
        <div className="space-y-6">
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {perfil.nombres} {perfil.apellidos}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Correo</dt>
              <dd className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                {perfil.correo}
                {perfil.correoVerificado ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Verificado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                    <MailWarning className="h-4 w-4" aria-hidden="true" /> Sin verificar
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-bold text-slate-900">Comunicaciones</h2>
            <p className="mt-1 text-xs text-slate-500">Los mensajes del servicio (confirmaciones de compra y avisos de seguridad) siempre se envían.</p>
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-black"
                checked={perfil.consentimientoMarketing}
                disabled={saving}
                onChange={(event) => toggleMarketing(event.target.checked)}
              />
              <span>Recibir ofertas y novedades por correo.</span>
            </label>
            {saveError != null && <ProblemAlert error={saveError} className="mt-3" />}
          </div>

          <p className="text-xs text-slate-500">
            Para corregir tus datos personales o eliminar tu cuenta, escríbenos desde{' '}
            <Link to="/ayuda#contacto" className="font-semibold text-brand-gold-dark hover:underline">
              Ayuda
            </Link>
            . Consulta cómo cuidamos tu información en la{' '}
            <Link to="/privacidad" className="font-semibold text-brand-gold-dark hover:underline">
              Política de privacidad
            </Link>
            .
          </p>
        </div>
      )}
    </AuthShell>
  );
};
