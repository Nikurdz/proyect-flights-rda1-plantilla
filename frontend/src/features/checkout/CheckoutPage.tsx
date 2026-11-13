import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, SearchX } from 'lucide-react';
import { useOferta } from '../../api/endpoints/offers';
import { CheckoutSummary } from './CheckoutSummary';
import { PassengerForm } from './PassengerForm';
import { BillingForm } from './BillingForm';
import { ConditionsForm } from './ConditionsForm';
import { PaymentForm } from './PaymentForm';
import { CheckoutBarContext } from './step-actions-context';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Stepper } from '../../components/ui/Stepper';
import { Countdown } from '../../components/common/Countdown';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { CHECKOUT_STEPS, hasActiveHold, holdUntil, resultsPathFromOffer, type CheckoutStep, type Titular } from '../../lib/checkout';
import { saveLastOrder } from '../../lib/storage';
import type { OfertaViewDto, OrdenViewDto } from '../../api/types';

const linkButton =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2.5 text-small font-medium transition-colors';

export const CheckoutPage: React.FC = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const { data: initialOferta, isLoading, error, refetch } = useOferta(offerId);

  // Local state for modified/updated offer
  const [currentOferta, setCurrentOferta] = useState<OfertaViewDto | null>(null);
  const activeOferta = currentOferta || initialOferta;

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('pasajeros');
  const [titular, setTitular] = useState<Titular | undefined>();
  const [leaving, setLeaving] = useState(false);
  // Where the primary action of a step goes on a phone (the fixed bar at the bottom).
  const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);

  const stepIndex = CHECKOUT_STEPS.findIndex((s) => s.id === currentStep);
  const step = CHECKOUT_STEPS[stepIndex];

  // Moving to another step moves the focus to its heading (the stepper announces it); not on the first render.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth' });
  }, [currentStep]);

  const goTo = (id: CheckoutStep) => setCurrentStep(id);

  // Expired offer handling
  const isExpired = activeOferta?.estado === 'VENCIDA';
  const ready = Boolean(activeOferta) && !isExpired;
  const resultsPath = resultsPathFromOffer(activeOferta);
  const retained = hasActiveHold(activeOferta);
  const until = holdUntil(activeOferta);

  const handleBackToResults = (event: React.MouseEvent) => {
    if (!retained) return; // nothing is held: the link just goes back
    event.preventDefault();
    setLeaving(true);
  };

  // Step 4 Success -> Confirmation Page
  const handlePaymentSuccess = (orden: OrdenViewDto) => {
    saveLastOrder(orden);
    navigate(`/confirmacion/${orden.numeroOrden}`, { state: { orden } });
  };

  const handleExpire = () => {
    void refetch();
  };

  return (
    <div className={`bg-paper px-4 py-8 sm:px-6 lg:px-8 ${ready && !isDesktop ? 'pb-32' : ''}`}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to={resultsPath} onClick={handleBackToResults} className="inline-flex min-h-[44px] items-center gap-2 text-small font-medium text-muted transition-colors hover:text-ink sm:min-h-0">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver a resultados</span>
          </Link>
          <Badge variant="outline">Precios en dólares (USD)</Badge>
        </div>

        <h1 ref={headingRef} tabIndex={-1} className="mb-5 text-heading font-semibold text-ink focus:outline-none">
          {ready ? step.title : 'Tu compra'}
        </h1>

        {error != null && <ProblemAlert error={error} onRetry={() => void refetch()} className="mb-6" />}

        {isExpired && (
          <EmptyState
            icon={<Clock />}
            title="Se acabó el tiempo de tu reserva"
            description="Liberamos los asientos pasados 15 minutos para que otras personas puedan reservarlos. No se hizo ningún cobro."
            action={
              <Link to={resultsPath} className={`${linkButton} bg-ink text-on-ink hover:bg-ink/90`}>
                Repetir la búsqueda
              </Link>
            }
          />
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3" role="status" aria-busy="true" aria-label="Cargando">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
            <Skeleton className="h-96 rounded-xl" />
          </div>
        ) : activeOferta && !isExpired ? (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
            <CheckoutBarContext.Provider value={barSlot}>
              <div className="space-y-6 lg:col-span-2">
                <Stepper
                  ariaLabel="Progreso de tu compra"
                  steps={CHECKOUT_STEPS.map((s) => ({ id: s.id, label: s.label }))}
                  current={stepIndex}
                  onStepClick={(index) => goTo(CHECKOUT_STEPS[index].id)}
                />

                {currentStep === 'pasajeros' && (
                  <PassengerForm
                    oferta={activeOferta}
                    onSuccess={(updated, first) => {
                      setCurrentOferta(updated);
                      if (first) setTitular(first);
                      goTo('facturacion');
                    }}
                  />
                )}

                {currentStep === 'facturacion' && (
                  <BillingForm
                    oferta={activeOferta}
                    titular={titular}
                    onSuccess={(updated) => {
                      setCurrentOferta(updated);
                      goTo('condiciones');
                    }}
                    onBack={() => goTo('pasajeros')}
                  />
                )}

                {currentStep === 'condiciones' && (
                  <ConditionsForm
                    oferta={activeOferta}
                    onSuccess={(updated) => {
                      setCurrentOferta(updated);
                      goTo('pago');
                    }}
                    onBack={() => goTo('facturacion')}
                  />
                )}

                {currentStep === 'pago' && (
                  <PaymentForm oferta={activeOferta} onSuccess={handlePaymentSuccess} onBack={() => goTo('condiciones')} onOfferUpdated={setCurrentOferta} />
                )}
              </div>
            </CheckoutBarContext.Provider>

            <div className="lg:sticky lg:top-24">
              <CheckoutSummary oferta={activeOferta} onExpire={handleExpire} showCountdown={isDesktop} />
            </div>
          </div>
        ) : null}

        {/* Nothing to buy: never leave a blank page. */}
        {!isLoading && !activeOferta && !error && (
          <EmptyState
            icon={<SearchX />}
            title="No encontramos tu reserva"
            description="Puede que haya vencido o que el enlace ya no sea válido. Haz una nueva búsqueda para continuar."
            action={
              <Link to="/" className={`${linkButton} bg-ink text-on-ink hover:bg-ink/90`}>
                Buscar vuelos
              </Link>
            }
          />
        )}
      </div>

      {/* Phone: total, countdown and the action of the step stay in reach. */}
      {ready && !isDesktop && activeOferta && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 shadow-elevated pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-small text-muted">Total del grupo</p>
              <MoneyText amount={activeOferta.total?.monto} currency={activeOferta.total?.moneda || activeOferta.moneda} size="xl" className="num text-ink" />
              {activeOferta.venceEn && (
                <div className="mt-1">
                  <Countdown venceEn={activeOferta.venceEn} initialSeconds={activeOferta.segundosRestantes} onExpire={handleExpire} />
                </div>
              )}
            </div>
            <div ref={setBarSlot} className="shrink-0" />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={leaving}
        title="¿Salir de la compra?"
        confirmLabel="Salir"
        cancelLabel="Seguir comprando"
        onConfirm={() => navigate(resultsPath)}
        onClose={() => setLeaving(false)}
      >
        <p>{until ? `Tu cupo sigue retenido hasta ${until}. ¿Salir?` : 'Tu cupo sigue retenido unos minutos. ¿Salir?'}</p>
        <p className="mt-2 text-small text-muted">Volverás a tu búsqueda y puedes retomar la compra desde aquí mientras dure el cupo.</p>
      </ConfirmDialog>
    </div>
  );
};
