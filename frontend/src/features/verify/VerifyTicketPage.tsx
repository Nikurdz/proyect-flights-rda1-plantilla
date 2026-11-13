import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { useVerificacionBillete } from '../../api/endpoints/orders';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDateTime } from '../../lib/labels';
import { timeZoneOf } from '../../lib/airports';
import { ticketStateLabel } from '../../lib/tickets';

/** Public page a passenger's QR code opens: says whether the ticket is authentic and issued, without any personal data. */
export const VerifyTicketPage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const { data, isLoading, error, refetch } = useVerificacionBillete(codigo);

  useEffect(() => {
    document.title = 'Verificar billete | RAM Alliance';
  }, []);

  return (
    <div className="bg-paper px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-lg rounded-xl border border-line bg-surface p-6 sm:p-8">
        <h1 className="mb-6 text-title font-semibold text-ink">Verificación de billete</h1>

        {error != null ? (
          <ProblemAlert error={error} title="No pudimos verificar el billete" onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <div role="status" aria-busy="true" aria-label="Cargando"><Skeleton className="h-40 rounded-2xl" /></div>
        ) : data.valido ? (
          <div role="status" className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden="true" />
            <div>
              <p className="text-lead font-semibold text-success">Billete válido</p>
              <p className="mt-1 text-small text-muted">
                Estado: <strong>{ticketStateLabel(data.estado)}</strong>
                {data.pnr ? (
                  <>
                    {' '}
                    · Código de reserva <span className="num font-semibold text-ink">{data.pnr}</span>
                  </>
                ) : null}
              </p>
            </div>
            <ul className="space-y-2 text-left">
              {data.itinerarios?.map((itin) => (
                <li key={`${itin.numeroVuelo}-${itin.salida}`} className="rounded-xl border border-line bg-paper p-4">
                  <span className="text-body font-medium text-ink">
                    Vuelo {itin.numeroVuelo}: {itin.origen} a {itin.destino}
                  </span>
                  <span className="num block text-small text-muted">Sale el {formatDateTime(itin.salida, timeZoneOf(itin.origen))} (hora local)</span>
                </li>
              ))}
            </ul>
            <p className="text-small text-muted">Por privacidad no mostramos nombres ni datos de contacto.</p>
          </div>
        ) : (
          <div role="alert" className="space-y-3 text-center">
            <ShieldAlert className="mx-auto h-14 w-14 text-danger" aria-hidden="true" />
            <p className="text-lead font-semibold text-danger">No pudimos validar este billete</p>
            <p className="text-small text-muted">
              El código no es auténtico, fue alterado o el billete ya no está emitido. Si crees que es un error, recupera tu viaje con tu código de reserva y apellido.
            </p>
            <ButtonLink to="/recuperar-orden" variant="outline">
              Gestionar mi viaje
            </ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
};
