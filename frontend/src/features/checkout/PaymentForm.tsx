import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, RotateCcw } from 'lucide-react';
import { comprarOferta, revalidarOferta, useMediosPago } from '../../api/endpoints/offers';
import { ProblemDetailsError } from '../../api/problem-details';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { resolveGatewayChoice } from '../../lib/cards';
import { resultsPathFromOffer } from '../../lib/checkout';
import { useCardForm } from '../../hooks/useCardForm';
import { generateUUID } from '../../lib/uuid';
import { CardFieldset } from '../experiences/CardFieldset';
import { PriceChangedModal } from './PriceChangedModal';
import { StepActions } from './StepActions';
import { CHECKOUT_FORM_ID } from './step-actions-context';
import type { CompraDto, MontoDto, OfertaViewDto, OrdenViewDto } from '../../api/types';

interface PaymentFormProps {
  oferta: OfertaViewDto;
  onSuccess: (orden: OrdenViewDto) => void;
  onBack: () => void;
  onOfferUpdated: (updated: OfertaViewDto) => void;
}

/**
 * Card form of the simulated checkout. The card data lives only in this component's state while the
 * form is open: it is never sent, stored (no localStorage, no sessionStorage, no cache) or logged.
 * Only a gateway token (brand + simulated outcome) goes to the API.
 */
export const PaymentForm: React.FC<PaymentFormProps> = ({ oferta, onSuccess, onBack, onOfferUpdated }) => {
  const navigate = useNavigate();

  const card = useCardForm();
  const [cuotas, setCuotas] = useState<number>(1);

  const [isRevalidating, setIsRevalidating] = useState(false);
  const [priceChange, setPriceChange] = useState<{ anterior: MontoDto; nuevo: MontoDto } | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<unknown>(null);

  // One Idempotency-Key per payment attempt: retrying the SAME payment after a network failure reuses
  // it (so it can never charge twice); a different card or plan is a different attempt.
  const idempotencyKeyRef = useRef<string>(generateUUID());
  const lastSignatureRef = useRef<string>('');
  const newAttempt = () => {
    idempotencyKeyRef.current = generateUUID();
  };

  const { data: mediosPago } = useMediosPago(oferta.ofertaId);
  const cardMethod = mediosPago?.find((m) => m.tipo === 'TARJETA');
  const availableCuotas = cardMethod?.cuotasPermitidas || [1];

  // Re-check price and availability when this step opens, before the person commits to pay.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsRevalidating(true);
        const res = await revalidarOferta(oferta.ofertaId);
        if (mounted && res.cambioDePrecio) setPriceChange({ anterior: res.precioAnterior, nuevo: res.precioNuevo });
      } catch {
        // Not blocking: the purchase re-validates on the server anyway.
      } finally {
        if (mounted) setIsRevalidating(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [oferta.ofertaId]);

  const handlePay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isPaying) return;
    card.touchAll();
    if (!card.valid) return;

    const choice = resolveGatewayChoice(card.number);
    if (!choice) return;

    // A different card or plan than the last attempt is a new payment: it needs its own key.
    const signature = `${choice.token}|${choice.marca}|${cuotas}`;
    if (signature !== lastSignatureRef.current) {
      newAttempt();
      lastSignatureRef.current = signature;
    }

    setIsPaying(true);
    setPaymentError(null);

    try {
      const payload: CompraDto = { medio: { tipo: 'TARJETA', token: choice.token, marca: choice.marca }, cuotas };
      const orden = await comprarOferta(oferta.ofertaId, payload, idempotencyKeyRef.current);
      // Nothing about the card is kept: wipe it before leaving the page.
      card.wipe();
      onSuccess(orden);
    } catch (error) {
      setPaymentError(error);
      const problem = error instanceof ProblemDetailsError ? error : null;

      // A rejected payment is a stored outcome of that attempt: the next one needs a new key.
      if (problem && (problem.status === 402 || problem.code === 'ISSUANCE_FAILED_COMPENSATED')) {
        newAttempt();
        lastSignatureRef.current = '';
      }
      card.setCvv('');

      if (problem?.code === 'PRICE_CHANGED') {
        try {
          const reval = await revalidarOferta(oferta.ofertaId);
          setPriceChange({ anterior: reval.precioAnterior, nuevo: reval.precioNuevo });
        } catch {
          // The alert above already says the price changed.
        }
      }
    } finally {
      setIsPaying(false);
    }
  };

  const blockedBySecurity = paymentError instanceof ProblemDetailsError && paymentError.code === 'PAYMENT_REJECTED_BY_FRAUD';
  const searchPath = resultsPathFromOffer(oferta);

  return (
    <div className="space-y-6">
      {priceChange && (
        <PriceChangedModal
          isOpen
          ofertaId={oferta.ofertaId}
          precioAnterior={priceChange.anterior}
          precioNuevo={priceChange.nuevo}
          onAccepted={(updated) => {
            setPriceChange(null);
            setPaymentError(null);
            newAttempt();
            lastSignatureRef.current = '';
            onOfferUpdated(updated);
          }}
          onCancel={() => navigate(searchPath)}
        />
      )}

      {paymentError != null && <ProblemAlert error={paymentError} title="No se pudo completar el pago" />}

      {blockedBySecurity && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 text-small text-warning sm:flex-row sm:items-center sm:justify-between">
          <span>Si ya intentaste pagar varias veces con esta reserva, el control de seguridad la bloquea. Empieza de nuevo con una búsqueda nueva.</span>
          <Button type="button" variant="primary" size="sm" onClick={() => navigate('/')} className="shrink-0">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Nueva búsqueda
          </Button>
        </div>
      )}

      <form id={CHECKOUT_FORM_ID} onSubmit={handlePay} noValidate autoComplete="off" className="space-y-6">
        <Card className="p-5 sm:p-6">
          <CardFieldset
            card={card}
            idPrefix="card"
            extra={
              <Select label="Cuotas" id="cuotas" value={cuotas} onChange={(event) => setCuotas(Number(event.target.value))} className="sm:max-w-xs">
                {availableCuotas.map((c) => (
                  <option key={c} value={c}>
                    {c === 1 ? 'Pago en 1 cuota' : `${c} cuotas`}
                  </option>
                ))}
              </Select>
            }
          />
        </Card>

        <StepActions
          variant="accent"
          submitLabel="Pagar y emitir mis boletos"
          icon={<Lock className="mr-2 h-4 w-4" aria-hidden="true" />}
          loading={isPaying}
          loadingLabel="Procesando el pago…"
          disabled={isRevalidating}
          reason="Estamos revisando que el precio siga vigente. Un momento."
          backLabel="Volver a condiciones"
          onBack={onBack}
          backDisabled={isPaying}
        />
      </form>
    </div>
  );
};
