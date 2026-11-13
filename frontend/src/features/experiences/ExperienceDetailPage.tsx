import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Receipt } from 'lucide-react';
import { useExperiencia } from '../../api/endpoints/experiencias';
import type { ReservaExternaView } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDay } from '../../lib/labels';
import { estadoReserva, estadoReservaVariant, sinCancelacionGratis, TEXTO_SIN_CANCELACION_GRATIS } from '../../lib/experiencias';
import { useToast } from '../../lib/toast';
import { ExperienceImage } from './ExperienceImage';
import { ReservationForm } from './ReservationForm';

const ResultItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-small text-muted">{label}</dt>
    <dd className="mt-1 text-ink">{children}</dd>
  </div>
);

/** The result of a successful reservation: state, total and the invoice number. */
const ReservationResult: React.FC<{ reserva: ReservaExternaView }> = ({ reserva: r }) => {
  const estado = estadoReserva(r.estado);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Move the focus to the result once, so a screen reader announces it and the form is gone.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <Card role="region" aria-labelledby="exp-result" className="border-success/40 p-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-success" aria-hidden="true" />
        <div>
          <h2 id="exp-result" ref={headingRef} tabIndex={-1} className="text-title font-semibold text-ink focus:outline-none">
            ¡Reserva realizada!
          </h2>
          <p className="text-small text-muted">Enviamos la confirmación a tu correo. Guarda estos datos.</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
        <ResultItem label="Estado">
          <Badge variant={estadoReservaVariant(r.estado)}>{estado.label}</Badge>
        </ResultItem>
        <ResultItem label="Experiencia">
          <span className="font-medium">{r.experiencia.nombre}</span>
        </ResultItem>
        <ResultItem label="Cuándo">
          {formatDay(`${r.fecha}T12:00:00Z`)}
          {r.hora ? `, ${r.hora}` : ''}
        </ResultItem>
        <ResultItem label="Personas">
          <span className="num">{r.cantidad}</span>
        </ResultItem>
        <ResultItem label="Total pagado">
          <MoneyText amount={r.total.monto} currency={r.total.moneda} size="lg" className="num" />
        </ResultItem>
        {r.referenciaProveedor && (
          <ResultItem label="Código del proveedor">
            <span className="num break-all font-semibold">{r.referenciaProveedor}</span>
          </ResultItem>
        )}
      </dl>
      <p className="mt-5 flex items-center gap-2 rounded-lg bg-gold-soft p-3 text-small text-ink">
        <Receipt className="h-5 w-5 shrink-0 text-gold-text" aria-hidden="true" />
        {r.factura ? (
          <span>
            Factura electrónica <strong className="num font-semibold">{r.factura}</strong>
          </span>
        ) : (
          <span>La factura se emitirá en unos instantes.</span>
        )}
      </p>
      {sinCancelacionGratis(r.estado, r.cancelacionGratis) && <p className="mt-3 text-small text-muted">{TEXTO_SIN_CANCELACION_GRATIS}.</p>}
      <div className="mt-5 flex flex-wrap gap-4 text-small font-medium">
        <Link to="/mis-experiencias" className="inline-flex min-h-[44px] items-center text-gold-text hover:underline sm:min-h-0">
          Ver mis experiencias
        </Link>
        <Link to="/experiencias" className="inline-flex min-h-[44px] items-center text-muted hover:text-ink hover:underline sm:min-h-0">
          Seguir explorando
        </Link>
      </div>
    </Card>
  );
};

export const ExperienceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: experiencia, isLoading, error, refetch } = useExperiencia(id);
  const [reserva, setReserva] = useState<ReservaExternaView | null>(null);
  const toast = useToast();

  useEffect(() => {
    document.title = `${experiencia?.nombre ?? 'Experiencia'} | RAM Alliance`;
  }, [experiencia?.nombre]);

  const handleReserved = (r: ReservaExternaView) => {
    setReserva(r);
    toast.success('Reserva realizada', `Enviamos la confirmación de «${r.experiencia.nombre}» a tu correo.`);
  };

  return (
    <div className="bg-paper px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/experiencias" className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-small font-medium text-muted transition-colors hover:text-ink sm:min-h-0">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a experiencias
        </Link>

        {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-6" />}

        {isLoading ? (
          <div role="status" aria-busy="true" aria-label="Cargando" className="space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        ) : (
          experiencia && (
            <div className="space-y-6">
              <article className="overflow-hidden rounded-xl border border-line bg-surface text-ink">
                <ExperienceImage url={experiencia.imagenUrl} className="h-56 w-full sm:h-72" />
                <div className="p-6">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" size="sm">{experiencia.tipo}</Badge>
                    {experiencia.cancelacionGratis ? <Badge variant="success" size="sm">Cancelación gratuita</Badge> : <Badge variant="warning" size="sm">Sin cancelación gratuita</Badge>}
                    {experiencia.categorias.map((c) => (
                      <Badge key={c} variant="secondary" size="sm">{c}</Badge>
                    ))}
                  </div>
                  <h1 className="text-heading font-semibold text-ink">{experiencia.nombre}</h1>
                  <p className="mt-0.5 text-small text-muted">Ofrece {experiencia.proveedor}</p>
                  <p className="mt-4 max-w-[68ch] whitespace-pre-line text-body text-ink">{experiencia.descripcion}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-6">
                    {experiencia.duracion && (
                      <span className="inline-flex items-center gap-1.5 text-body text-muted">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        {experiencia.duracion}
                      </span>
                    )}
                    <span className="text-body text-muted">
                      Por persona: <MoneyText amount={experiencia.precio.monto} currency={experiencia.precio.moneda} size="lg" className="num text-ink" />
                    </span>
                  </div>
                </div>
              </article>

              {reserva ? <ReservationResult reserva={reserva} /> : <ReservationForm experiencia={experiencia} onReserved={handleReserved} onPriceChanged={() => void refetch()} />}
            </div>
          )
        )}
      </div>
    </div>
  );
};
