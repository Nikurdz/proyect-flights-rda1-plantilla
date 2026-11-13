import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, MailWarning } from 'lucide-react';
import { actualizarPreferencias, usePerfil } from '../../api/endpoints/auth';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../lib/toast';
import { useSession } from '../../lib/session';
import { AuthShell } from './AuthShell';

export const ProfilePage: React.FC = () => {
  const session = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: perfil, isLoading, error, refetch } = usePerfil(session?.kind === 'customer', session?.ownerId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  const toggleMarketing = async (value: boolean) => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await actualizarPreferencias({ consentimientoMarketing: value });
      queryClient.setQueryData(['perfil-me', session?.ownerId], updated);
      toast.success(value ? 'Activaste las ofertas por correo' : 'Dejaste de recibir ofertas por correo');
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
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-small text-muted">Nombre</dt>
              <dd className="mt-1 text-body font-medium text-ink">
                {perfil.nombres} {perfil.apellidos}
              </dd>
            </div>
            <div>
              <dt className="text-small text-muted">Correo</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 text-body font-medium text-ink">
                <span className="break-all">{perfil.correo}</span>
                {perfil.correoVerificado ? (
                  <Badge variant="success" icon={<BadgeCheck />}>
                    Verificado
                  </Badge>
                ) : (
                  <Badge variant="warning" icon={<MailWarning />}>
                    Sin verificar
                  </Badge>
                )}
              </dd>
            </div>
          </dl>

          {!perfil.correoVerificado && (
            <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-small text-ink" role="note">
              <p className="font-semibold">Verifica tu correo para proteger tu cuenta.</p>
              <p className="mt-1">
                Abre el mensaje que te enviamos y entra al enlace que trae. Verificarlo no es necesario para comprar. Si no encuentras el mensaje, mira{' '}
                <Link to="/ayuda#cuenta" className="font-medium text-gold-text underline underline-offset-2 hover:text-ink">
                  cómo pedir un enlace nuevo en Ayuda
                </Link>
                .
              </p>
            </div>
          )}

          <div className="rounded-xl border border-line bg-paper p-4">
            <h2 className="text-lead font-semibold text-ink">Comunicaciones</h2>
            <p className="mt-1 text-small text-muted">Los mensajes del servicio, como la confirmación de tu compra y los avisos de seguridad, siempre se envían.</p>
            <label className="mt-3 flex min-h-[44px] cursor-pointer items-start gap-3 text-body text-ink">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 rounded border-line-strong accent-ink"
                checked={perfil.consentimientoMarketing}
                disabled={saving}
                onChange={(event) => toggleMarketing(event.target.checked)}
              />
              <span>Recibir ofertas y novedades por correo</span>
            </label>
            {saveError != null && <ProblemAlert error={saveError} className="mt-3" />}
          </div>

          <p className="text-small text-muted">
            Para corregir tus datos personales o eliminar tu cuenta, escríbenos desde{' '}
            <Link to="/ayuda#contacto" className="font-medium text-gold-text underline underline-offset-2 hover:text-ink">
              Ayuda
            </Link>
            . Consulta cómo cuidamos tu información en la{' '}
            <Link to="/privacidad" className="font-medium text-gold-text underline underline-offset-2 hover:text-ink">
              Política de privacidad
            </Link>
            .
          </p>
        </div>
      )}
    </AuthShell>
  );
};
