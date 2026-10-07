import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Copy, Mail, Plane, Printer, Ticket, UserPlus } from 'lucide-react';
import { useOrdenPropia } from '../../api/endpoints/orders';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Logo } from '../../components/ui/Logo';
import { Skeleton } from '../../components/ui/Skeleton';
import { TicketQr } from '../../components/common/TicketQr';
import { timeZoneOf } from '../../lib/airports';
import { fareFamilyLabel, formatDateTime, orderStatusLabel, passengerTypeLabel } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { loadLastOrder, saveLastOrder } from '../../lib/storage';
import type { OrdenViewDto } from '../../api/types';

export const ConfirmationPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const session = useSession();

  // Where the order comes from: the page that sent us here, the copy kept for this tab (so a
  // refresh or a print still works for a guest), or, with a session, the API.
  const stateOrden = (location.state as { orden?: OrdenViewDto } | null)?.orden;
  const cachedOrden = orderNumber ? loadLastOrder<OrdenViewDto>(orderNumber) : null;
  const known = stateOrden ?? cachedOrden ?? undefined;

  const { data: fetchedOrden, isLoading, error } = useOrdenPropia(known ? undefined : orderNumber, Boolean(session));
  const orden = known ?? fetchedOrden;

  const [copiedPnr, setCopiedPnr] = useState(false);

  useEffect(() => {
    if (orden) saveLastOrder(orden);
    document.title = 'Tu reserva | RAM Alliance';
  }, [orden]);

  const handleCopyPnr = async () => {
    if (!orden?.pnr) return;
    try {
      await navigator.clipboard.writeText(orden.pnr);
      setCopiedPnr(true);
      setTimeout(() => setCopiedPnr(false), 2000);
    } catch {
      setCopiedPnr(false);
    }
  };

  const confirmed = orden?.estado === 'EMITIDA';
  const isGuest = session?.kind !== 'customer';

  // Offer to keep the trip in an account, with what we already know filled in.
  const firstPassenger = orden?.pasajeros?.[0];
  const registerParams = new URLSearchParams({ next: '/mis-ordenes' });
  if (orden?.contacto?.correo) registerParams.set('correo', orden.contacto.correo);
  if (firstPassenger) {
    registerParams.set('nombres', firstPassenger.nombres);
    registerParams.set('apellidos', firstPassenger.apellidos);
  }

  return (
    <div className="bg-airline-sand px-4 py-10 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl space-y-6">
        {orden && (
          <div className="space-y-3 text-center print:hidden">
            <div className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
              <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {confirmed ? '¡Tu reserva está confirmada!' : 'Detalle de tu reserva'}
            </h1>
            <p className="mx-auto max-w-xl text-xs text-slate-600 sm:text-sm">
              Guarda tu código de reserva. Puedes recuperar este comprobante cuando quieras con ese código y tu apellido.
            </p>
          </div>
        )}

        {error != null && !orden && (
          <div className="space-y-3">
            <ProblemAlert error={error} />
            <p className="text-center text-xs text-slate-600">
              Si compraste sin cuenta, recupera tu viaje con tu código de reserva en{' '}
              <Link to="/recuperar-orden" className="font-bold text-brand-gold-dark underline">
                Gestionar viaje
              </Link>
              .
            </p>
          </div>
        )}

        {!orden && !error && !session && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">No pudimos mostrar esta reserva</h1>
            <p className="mt-2 text-sm text-slate-600">Para verla, ingresa tu código de reserva y tu apellido.</p>
            <Link to="/recuperar-orden" className="mt-5 inline-block rounded-lg bg-brand-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-navy">
              Gestionar viaje
            </Link>
          </div>
        )}

        {isLoading && !orden ? (
          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : orden ? (
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card print:border-none print:shadow-none">
            <div className="flex flex-col items-center justify-between gap-4 border-b border-brand-gold/30 bg-brand-black p-6 text-white sm:flex-row sm:p-8">
              <Logo variant="full" inverted />
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/20 print:hidden"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Imprimir comprobante</span>
              </button>
            </div>

            <div className="space-y-8 p-6 sm:p-8">
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
                <div className="border-b border-slate-200 pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Código de reserva</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xl font-black tracking-widest text-brand-black sm:text-3xl">{orden.pnr || '—'}</span>
                    {orden.pnr && (
                      <button
                        type="button"
                        onClick={handleCopyPnr}
                        aria-label="Copiar código de reserva"
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-brand-black print:hidden"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {copiedPnr && (
                    <span className="mt-1 block text-[10px] font-bold text-emerald-600" role="status">
                      Código copiado
                    </span>
                  )}
                </div>

                <div className="border-b border-slate-200 pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Número de orden</span>
                  <span className="font-mono text-sm font-black text-slate-800">{orden.numeroOrden}</span>
                  <span className="mt-1 block text-[11px] text-slate-400">Compra del {formatDateTime(orden.creadaEn)}</span>
                </div>

                <div className="flex flex-col justify-between">
                  <div>
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Estado</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      {orderStatusLabel(orden.estado)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="block text-[11px] text-slate-400">Total pagado</span>
                    <MoneyText amount={orden.total.monto} currency={orden.total.moneda} size="lg" className="font-black text-brand-black" />
                  </div>
                </div>
              </div>

              <section className="space-y-4" aria-labelledby="itinerario">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Plane className="h-4 w-4 text-brand-black" aria-hidden="true" />
                  <h2 id="itinerario" className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    Itinerario
                  </h2>
                </div>

                <div className="space-y-3">
                  {orden.itinerarios.map((itin, idx) => (
                    <div key={idx} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-black text-slate-900">Vuelo {itin.numeroVuelo}</span>
                          <span className="text-xs font-bold text-slate-500">
                            Tarifa <strong>{fareFamilyLabel(itin.familia)}</strong>
                          </span>
                        </div>
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Vuelo directo</span>
                      </div>

                      <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                        <div>
                          <span className="block text-[11px] text-slate-400">Origen</span>
                          <span className="text-sm font-extrabold text-slate-800">{itin.origen}</span>
                          <span className="block text-[11px] text-slate-500">Salida: {formatDateTime(itin.salida, timeZoneOf(itin.origen))} (hora local)</span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">Destino</span>
                          <span className="text-sm font-extrabold text-slate-800">{itin.destino}</span>
                          <span className="block text-[11px] text-slate-500">Llegada: {formatDateTime(itin.llegada, timeZoneOf(itin.destino))} (hora local)</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4" aria-labelledby="pasajeros">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Ticket className="h-4 w-4 text-brand-black" aria-hidden="true" />
                  <h2 id="pasajeros" className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    Pasajeros y billetes electrónicos
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {orden.pasajeros.map((pax) => (
                    <div key={pax.id} className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {pax.nombres} {pax.apellidos}
                        </span>
                        <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">{passengerTypeLabel(pax.tipo)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                        <span className="text-[11px] text-slate-500">Billete electrónico</span>
                        <span className="font-mono text-xs font-black tracking-wider text-brand-black">{pax.eTicket || 'Pendiente'}</span>
                      </div>
                      {pax.asientos && pax.asientos.length > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Asiento{pax.asientos.length > 1 ? 's' : ''}</span>
                          <span className="font-mono font-bold text-slate-800">{pax.asientos.map((a) => `${a.numeroVuelo} · ${a.asiento}`).join('   ')}</span>
                        </div>
                      )}
                      {pax.qr && (
                        <div className="flex justify-center border-t border-slate-200/60 pt-3">
                          <TicketQr code={pax.qr} passengerName={`${pax.nombres} ${pax.apellidos}`} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {isGuest && (
                <div className="space-y-3 rounded-2xl border border-brand-gold/30 bg-brand-black p-6 text-white print:hidden">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-xl bg-brand-gold/20 p-3 text-brand-gold">
                      <UserPlus className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-sm font-bold text-white">Guarda este viaje en una cuenta</h2>
                      <p className="text-xs leading-relaxed text-slate-300">
                        Con una cuenta gratuita ves todos tus viajes en un solo lugar y compras más rápido. Ya completamos tus datos.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Link
                      to={`/registro?${registerParams.toString()}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-6 py-2.5 text-xs font-black text-brand-black transition-colors hover:bg-brand-gold-light"
                    >
                      <span>Crear mi cuenta</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-slate-200 pt-5 text-xs text-slate-500">
                <div className="flex items-center gap-2 font-bold text-slate-700">
                  <Mail className="h-4 w-4 text-brand-black" aria-hidden="true" />
                  <span>Antes de viajar</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Lleva tu documento de viaje original y vigente. Te recomendamos llegar al aeropuerto con 2 horas de anticipación en vuelos regionales y 3 horas en intercontinentales. Para ver esta reserva de nuevo usa tu código de reserva ({orden.pnr}) y tu apellido en{' '}
                  <Link to="/recuperar-orden" className="font-semibold text-brand-gold-dark underline">
                    Gestionar viaje
                  </Link>
                  . Este sitio es un prototipo: la reserva y los billetes son simulados.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="pt-4 text-center print:hidden">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-brand-black">
            <span>Volver al inicio</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
};
