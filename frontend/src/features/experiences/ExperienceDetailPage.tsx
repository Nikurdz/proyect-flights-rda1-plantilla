import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Receipt } from 'lucide-react';
import { useExperiencia } from '../../api/endpoints/experiencias';
import type { ReservaExternaView } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDay } from '../../lib/labels';
import { estadoReserva, sinCancelacionGratis, TEXTO_SIN_CANCELACION_GRATIS } from '../../lib/experiencias';
import { ExperienceImage } from './ExperienceImage';
import { ReservationForm } from './ReservationForm';

/** The result of a successful reservation: state, total and the invoice number. */
const ReservationResult: React.FC<{ reserva: ReservaExternaView }> = ({ reserva: r }) => {
  const estado = estadoReserva(r.estado);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Move the focus to the result once, so a screen reader announces it and the form is gone.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section aria-labelledby="exp-result" className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-600" aria-hidden="true" />
        <div>
          <h2 id="exp-result" ref={headingRef} tabIndex={-1} className="text-lg font-black text-brand-black focus:outline-none">
            ¡Reserva realizada!
          </h2>
          <p className="text-xs text-slate-600">Enviamos la confirmación a tu correo. Guarda estos datos.</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Estado</dt>
          <dd className="mt-1">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${estado.className}`}>{estado.label}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Experiencia</dt>
          <dd className="mt-1 font-semibold text-slate-900">{r.experiencia.nombre}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cuándo</dt>
          <dd className="mt-1 text-slate-900">
            {formatDay(`${r.fecha}T12:00:00Z`)}
            {r.hora ? `, ${r.hora}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Personas</dt>
          <dd className="mt-1 text-slate-900">{r.cantidad}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total pagado</dt>
          <dd className="mt-1">
            <MoneyText amount={r.total.monto} currency={r.total.moneda} size="lg" />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Código del proveedor</dt>
          <dd className="mt-1 break-all font-mono text-sm font-bold text-slate-900">{r.referenciaProveedor ?? 'pendiente'}</dd>
        </div>
      </dl>
      <p className="mt-5 flex items-center gap-2 rounded-xl bg-brand-gold-light p-3 text-sm text-slate-800">
        <Receipt className="h-5 w-5 shrink-0 text-brand-gold-dark" aria-hidden="true" />
        {r.factura ? (
          <span>
            Factura electrónica <strong className="font-mono">{r.factura}</strong>
          </span>
        ) : (
          <span>La factura se emitirá en unos instantes.</span>
        )}
      </p>
      {sinCancelacionGratis(r.estado, r.cancelacionGratis) && <p className="mt-3 text-xs text-slate-600">{TEXTO_SIN_CANCELACION_GRATIS}.</p>}
      <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold">
        <Link to="/mis-experiencias" className="text-brand-gold-dark hover:underline">
          Ver mis experiencias
        </Link>
        <Link to="/experiencias" className="text-slate-600 hover:underline">
          Seguir explorando
        </Link>
      </div>
    </section>
  );
};

export const ExperienceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: experiencia, isLoading, error, refetch } = useExperiencia(id);
  const [reserva, setReserva] = useState<ReservaExternaView | null>(null);

  useEffect(() => {
    document.title = `${experiencia?.nombre ?? 'Experiencia'} | RAM Alliance`;
  }, [experiencia?.nombre]);

  return (
    <div className="bg-airline-sand px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/experiencias" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-slate-600 transition-colors hover:text-brand-black">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a experiencias
        </Link>

        {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-6" />}

        {isLoading ? (
          <div role="status" aria-busy="true" aria-label="Cargando" className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        ) : (
          experiencia && (
            <div className="space-y-6">
              <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <ExperienceImage url={experiencia.imagenUrl} className="h-56 w-full sm:h-72" />
                <div className="p-6">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" size="sm">{experiencia.tipo}</Badge>
                    {experiencia.cancelacionGratis ? <Badge variant="success" size="sm">Cancelación gratuita</Badge> : <Badge variant="warning" size="sm">Sin cancelación gratuita</Badge>}
                    {experiencia.categorias.map((c) => (
                      <Badge key={c} variant="secondary" size="sm">{c}</Badge>
                    ))}
                  </div>
                  <h1 className="text-2xl font-black text-brand-black">{experiencia.nombre}</h1>
                  <p className="mt-0.5 text-xs text-slate-500">Ofrece {experiencia.proveedor}</p>
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{experiencia.descripcion}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-6">
                    {experiencia.duracion && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        {experiencia.duracion}
                      </span>
                    )}
                    <span className="text-sm text-slate-700">
                      Por persona: <MoneyText amount={experiencia.precio.monto} currency={experiencia.precio.moneda} size="lg" />
                    </span>
                  </div>
                </div>
              </article>

              {reserva ? <ReservationResult reserva={reserva} /> : <ReservationForm experiencia={experiencia} onReserved={setReserva} onPriceChanged={() => void refetch()} />}
            </div>
          )
        )}
      </div>
    </div>
  );
};
