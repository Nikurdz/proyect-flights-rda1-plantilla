import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { useOferta } from '../../api/endpoints/offers';
import { CheckoutStepper, type CheckoutStep } from './CheckoutStepper';
import { CheckoutSummary } from './CheckoutSummary';
import { PassengerForm } from './PassengerForm';
import { BillingForm } from './BillingForm';
import { ConditionsForm } from './ConditionsForm';
import { PaymentForm } from './PaymentForm';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { saveLastOrder } from '../../lib/storage';
import type { OfertaViewDto, OrdenViewDto } from '../../api/types';

export const CheckoutPage: React.FC = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();

  const { data: initialOferta, isLoading, error, refetch } = useOferta(offerId);

  // Local state for modified/updated offer
  const [currentOferta, setCurrentOferta] = useState<OfertaViewDto | null>(null);
  const activeOferta = currentOferta || initialOferta;

  // Active step and completed steps
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('pasajeros');
  const [completedSteps, setCompletedSteps] = useState<CheckoutStep[]>([]);

  // Update offer after a step succeeds
  const handleOfferUpdated = (updated: OfertaViewDto) => {
    setCurrentOferta(updated);
  };

  // Step 1 -> Step 2
  const handlePassengersSuccess = (updated: OfertaViewDto) => {
    handleOfferUpdated(updated);
    setCompletedSteps((prev) => Array.from(new Set([...prev, 'pasajeros'])));
    setCurrentStep('facturacion');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2 -> Step 3
  const handleBillingSuccess = (updated: OfertaViewDto) => {
    handleOfferUpdated(updated);
    setCompletedSteps((prev) => Array.from(new Set([...prev, 'facturacion'])));
    setCurrentStep('condiciones');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 3 -> Step 4
  const handleConditionsSuccess = (updated: OfertaViewDto) => {
    handleOfferUpdated(updated);
    setCompletedSteps((prev) => Array.from(new Set([...prev, 'condiciones'])));
    setCurrentStep('pago');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 4 Success -> Confirmation Page
  const handlePaymentSuccess = (orden: OrdenViewDto) => {
    saveLastOrder(orden);
    navigate(`/confirmacion/${orden.numeroOrden}`, { state: { orden } });
  };

  // Expired offer handling
  const isExpired = activeOferta?.estado === 'VENCIDA';

  return (
    <div className="bg-airline-sand px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/resultados"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-brand-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Volver a resultados</span>
          </Link>

          <span className="rounded-full border border-brand-gold/40 bg-brand-gold-light px-3 py-1 text-xs font-semibold text-brand-gold-dark">
            Precios en dólares (USD)
          </span>
        </div>

        {error != null && <ProblemAlert error={error} className="mb-6" />}

        {/* Expired Offer Banner */}
        {isExpired && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-950 mb-1">
                El tiempo de tu reserva terminó
              </h3>
              <p className="text-xs text-rose-800 max-w-md mx-auto">
                Liberamos los asientos pasados 15 minutos para que otras personas puedan reservarlos. No se hizo ningún
                cobro. Haz una nueva búsqueda para continuar.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-airline-navy text-white text-xs font-bold hover:bg-slate-900 transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Buscar nuevos vuelos</span>
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-96 rounded-2xl" />
            </div>
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        ) : activeOferta && !isExpired ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Main Interactive Steps Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stepper Progress Bar */}
              <CheckoutStepper
                currentStep={currentStep}
                completedSteps={completedSteps}
                onStepClick={(step) => setCurrentStep(step)}
              />

              {/* Step 1: Pasajeros */}
              {currentStep === 'pasajeros' && (
                <PassengerForm oferta={activeOferta} onSuccess={handlePassengersSuccess} />
              )}

              {/* Step 2: Facturación */}
              {currentStep === 'facturacion' && (
                <BillingForm
                  oferta={activeOferta}
                  onSuccess={handleBillingSuccess}
                  onBack={() => setCurrentStep('pasajeros')}
                />
              )}

              {/* Step 3: Condiciones */}
              {currentStep === 'condiciones' && (
                <ConditionsForm
                  oferta={activeOferta}
                  onSuccess={handleConditionsSuccess}
                  onBack={() => setCurrentStep('facturacion')}
                />
              )}

              {/* Step 4: Pago */}
              {currentStep === 'pago' && (
                <PaymentForm
                  oferta={activeOferta}
                  onSuccess={handlePaymentSuccess}
                  onBack={() => setCurrentStep('condiciones')}
                  onOfferUpdated={handleOfferUpdated}
                />
              )}
            </div>

            {/* Sticky Summary Column */}
            <div className="lg:col-span-1 lg:sticky lg:top-24">
              <CheckoutSummary
                oferta={activeOferta}
                onExpire={() => {
                  refetch();
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
