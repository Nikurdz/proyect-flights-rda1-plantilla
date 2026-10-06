import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { useVerificacionBillete } from '../../api/endpoints/orders';
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
    <div className="bg-airline-sand px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-card">
        <h1 className="mb-6 text-center text-xl font-black text-brand-black">Verificación de billete</h1>

        {error != null ? (
          <ProblemAlert error={error} title="No pudimos verificar el billete" onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : data.valido ? (
          <div role="status" className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-lg font-bold text-emerald-700">Billete válido</p>
              <p className="mt-1 text-xs text-slate-500">
                Estado: <strong>{ticketStateLabel(data.estado)}</strong>
                {data.pnr ? (
                  <>
                    {' '}
                    · Código de reserva <span className="font-mono font-bold text-slate-800">{data.pnr}</span>
                  </>
                ) : null}
              </p>
            </div>
            <ul className="space-y-2 text-left">
              {data.itinerarios?.map((itin) => (
                <li key={`${itin.numeroVuelo}-${itin.salida}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <span className="font-bold text-slate-900">
                    Vuelo {itin.numeroVuelo} · {itin.origen} → {itin.destino}
                  </span>
                  <span className="block text-xs text-slate-500">Salida: {formatDateTime(itin.salida, timeZoneOf(itin.origen))} (hora local)</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-400">Por privacidad no mostramos nombres ni datos de contacto.</p>
          </div>
        ) : (
          <div role="alert" className="space-y-3 text-center">
            <ShieldAlert className="mx-auto h-14 w-14 text-red-600" aria-hidden="true" />
            <p className="text-lg font-bold text-red-700">No pudimos validar este billete</p>
            <p className="text-xs leading-relaxed text-slate-600">
              El código no es auténtico, fue alterado o el billete ya no está emitido. Si crees que es un error, recupera tu viaje con tu código de reserva y apellido.
            </p>
            <Link to="/recuperar-orden" className="inline-block text-xs font-bold text-brand-gold-dark hover:underline">
              Gestionar mi viaje
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
