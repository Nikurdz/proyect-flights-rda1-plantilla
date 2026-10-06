import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Info, Lock } from 'lucide-react';
import { comprarOferta, revalidarOferta, useMediosPago } from '../../api/endpoints/offers';
import { ProblemDetailsError } from '../../api/problem-details';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { generateUUID } from '../../lib/uuid';
import { PriceChangedModal } from './PriceChangedModal';
import type { CompraDto, MontoDto, OfertaViewDto, OrdenViewDto } from '../../api/types';

interface PaymentFormProps {
  oferta: OfertaViewDto;
  onSuccess: (orden: OrdenViewDto) => void;
  onBack: () => void;
  onOfferUpdated: (updated: OfertaViewDto) => void;
}

interface Scenario {
  id: string;
  label: string;
  hint: string;
  brand: string;
  token: string;
  tone: 'ok' | 'decline' | 'special';
  /** Shown only when VITE_SHOW_TEST_CARDS is on (development and demos of the failure paths). */
  devOnly?: boolean;
}

/**
 * The payment gateway is simulated and takes a token that decides the outcome. People never type a
 * card number here: they pick what the simulation should do.
 */
const SCENARIOS: Scenario[] = [
  { id: 'visa_ok', label: 'Visa', hint: 'El pago se aprueba.', brand: 'VISA', token: 'tok_visa_ok', tone: 'ok' },
  { id: 'mc_ok', label: 'Mastercard', hint: 'El pago se aprueba.', brand: 'MASTERCARD', token: 'tok_mastercard_ok', tone: 'ok' },
  { id: 'amex_ok', label: 'American Express', hint: 'El pago se aprueba.', brand: 'AMEX', token: 'tok_amex_ok', tone: 'ok', devOnly: true },
  { id: 'diners_ok', label: 'Diners Club', hint: 'El pago se aprueba.', brand: 'DINERS', token: 'tok_diners_ok', tone: 'ok', devOnly: true },
  { id: 'declined', label: 'Tarjeta rechazada por el banco', hint: 'Simula un rechazo: tu reserva sigue vigente.', brand: 'VISA', token: 'tok_declined', tone: 'decline' },
  { id: 'insufficient', label: 'Fondos insuficientes', hint: 'Simula un rechazo por saldo.', brand: 'VISA', token: 'tok_insufficient', tone: 'decline', devOnly: true },
  { id: 'expired', label: 'Tarjeta vencida', hint: 'Simula un rechazo por vencimiento.', brand: 'VISA', token: 'tok_expired', tone: 'decline', devOnly: true },
  { id: 'fraud', label: 'Bloqueo de seguridad', hint: 'Simula un rechazo del control antifraude.', brand: 'VISA', token: 'tok_fraud', tone: 'decline', devOnly: true },
  { id: 'capture_fail', label: 'Aprobado, falla el cobro final', hint: 'La orden se emite y el cobro queda pendiente.', brand: 'VISA', token: 'tok_visa_capture_fail', tone: 'special', devOnly: true },
];

const SHOW_TEST_CARDS = import.meta.env.VITE_SHOW_TEST_CARDS === 'true';

const toneClasses: Record<Scenario['tone'], string> = {
  ok: 'bg-emerald-50 text-emerald-700',
  decline: 'bg-rose-50 text-rose-700',
  special: 'bg-amber-50 text-amber-700',
};

export const PaymentForm: React.FC<PaymentFormProps> = ({ oferta, onSuccess, onBack, onOfferUpdated }) => {
  const navigate = useNavigate();
  const scenarios = SCENARIOS.filter((scenario) => SHOW_TEST_CARDS || !scenario.devOnly);

  const [selected, setSelected] = useState<Scenario>(scenarios[0]);
  const [cuotas, setCuotas] = useState<number>(1);

  const [isRevalidating, setIsRevalidating] = useState(false);
  const [priceChange, setPriceChange] = useState<{ anterior: MontoDto; nuevo: MontoDto } | null>(null);

  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<unknown>(null);

  // One Idempotency-Key per payment attempt: a retry after a network failure reuses it (so it can
  // never charge twice), while a different card or plan is a different attempt and gets a new one.
  const idempotencyKeyRef = useRef<string>(generateUUID());
  const newAttempt = () => {
    idempotencyKeyRef.current = generateUUID();
  };

  const { data: mediosPago } = useMediosPago(oferta.ofertaId);
  const cardMethod = mediosPago?.find((m) => m.tipo === 'TARJETA');
  const availableCuotas = cardMethod?.cuotasPermitidas || [1];

  // Re-check price and availability right when this step opens (before the person commits to pay).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsRevalidating(true);
        const res = await revalidarOferta(oferta.ofertaId);
        if (mounted && res.cambioDePrecio) setPriceChange({ anterior: res.precioAnterior, nuevo: res.precioNuevo });
      } catch {
        // A failed check is not blocking: the purchase re-validates on the server anyway.
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
    setIsPaying(true);
    setPaymentError(null);

    try {
      const payload: CompraDto = {
        medio: { tipo: 'TARJETA', token: selected.token, marca: selected.brand },
        cuotas,
      };
      const orden = await comprarOferta(oferta.ofertaId, payload, idempotencyKeyRef.current);
      onSuccess(orden);
    } catch (error) {
      setPaymentError(error);
      const problem = error instanceof ProblemDetailsError ? error : null;

      // A rejected payment is a stored outcome of that attempt: the next one needs a new key.
      if (problem && (problem.status === 402 || problem.code === 'ISSUANCE_FAILED_COMPENSATED')) newAttempt();

      if (problem?.code === 'PRICE_CHANGED') {
        try {
          const reval = await revalidarOferta(oferta.ofertaId);
          setPriceChange({ anterior: reval.precioAnterior, nuevo: reval.precioNuevo });
        } catch {
          // The alert above already tells the person the price changed.
        }
      }
    } finally {
      setIsPaying(false);
    }
  };

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
            onOfferUpdated(updated);
          }}
          onCancel={() => navigate('/')}
        />
      )}

      {paymentError != null && <ProblemAlert error={paymentError} title="No se pudo completar el pago" className="mb-2" />}

      <form onSubmit={handlePay} className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-black/5 text-brand-black">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pago con tarjeta (simulado)</h3>
            <p className="text-xs text-slate-500">Elige cómo debe responder el pago de prueba.</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-brand-gold/40 bg-brand-gold-light p-3 text-xs text-slate-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold-dark" aria-hidden="true" />
          <p>
            <strong className="text-brand-black">Este sitio es un prototipo.</strong> No ingreses datos de una tarjeta real: el pago es una simulación y no se cobra dinero.
          </p>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Resultado del pago de prueba</legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {scenarios.map((scenario) => {
              const isSelected = selected.id === scenario.id;
              return (
                <label
                  key={scenario.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition-all ${
                    isSelected ? 'border-brand-gold bg-brand-gold-light ring-1 ring-brand-gold' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="escenario"
                    className="mt-0.5 h-4 w-4 text-brand-black"
                    checked={isSelected}
                    onChange={() => {
                      setSelected(scenario);
                      newAttempt();
                    }}
                  />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{scenario.label}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${toneClasses[scenario.tone]}`}>
                        {scenario.tone === 'ok' ? 'Aprueba' : scenario.tone === 'decline' ? 'Rechaza' : 'Especial'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-slate-500">{scenario.hint}</span>
                    {SHOW_TEST_CARDS && <span className="mt-1 block font-mono text-[10px] text-slate-400">{scenario.token}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="sm:w-1/2">
          <label htmlFor="cuotas" className="mb-1 block text-xs font-bold text-slate-700">
            Cuotas
          </label>
          <select
            id="cuotas"
            value={cuotas}
            onChange={(event) => {
              setCuotas(Number(event.target.value));
              newAttempt();
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
          >
            {availableCuotas.map((c) => (
              <option key={c} value={c}>
                {c === 1 ? 'Pago en 1 cuota' : `${c} cuotas`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isPaying}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver</span>
          </button>

          <button
            type="submit"
            disabled={isPaying || isRevalidating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-black px-8 py-3.5 text-sm font-black text-white shadow-lg transition-all hover:bg-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPaying ? (
              <span>Procesando el pago…</span>
            ) : (
              <>
                <Lock className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                <span>Pagar y emitir mis boletos</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
