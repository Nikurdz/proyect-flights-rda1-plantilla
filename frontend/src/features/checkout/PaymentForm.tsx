import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, Lock, RotateCcw } from 'lucide-react';
import { comprarOferta, revalidarOferta, useMediosPago } from '../../api/endpoints/offers';
import { ProblemDetailsError } from '../../api/problem-details';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { AcceptedBrands, CardBrandLogo } from '../../components/ui/CardBrandLogo';
import {
  ACCEPTED_BRANDS,
  APPROVED_TEST_NUMBERS,
  BRAND_NAMES,
  TEST_NUMBERS,
  cvvLength,
  detectBrand,
  formatCardNumber,
  formatExpiry,
  onlyDigits,
  resolveGatewayChoice,
  validateCard,
  type CardErrors,
} from '../../lib/cards';
import { generateUUID } from '../../lib/uuid';
import { PriceChangedModal } from './PriceChangedModal';
import type { CompraDto, MontoDto, OfertaViewDto, OrdenViewDto } from '../../api/types';

interface PaymentFormProps {
  oferta: OfertaViewDto;
  onSuccess: (orden: OrdenViewDto) => void;
  onBack: () => void;
  onOfferUpdated: (updated: OfertaViewDto) => void;
}

const SHOW_TEST_CARDS = import.meta.env.VITE_SHOW_TEST_CARDS === 'true';

const fieldClass = (error?: string) =>
  `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
    error ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-brand-gold focus:ring-brand-gold/20'
  }`;

/**
 * Card form of the simulated checkout. The card data lives only in this component's state while the
 * form is open: it is never sent, stored (no localStorage, no sessionStorage, no cache) or logged.
 * Only a gateway token (brand + simulated outcome) goes to the API.
 */
export const PaymentForm: React.FC<PaymentFormProps> = ({ oferta, onSuccess, onBack, onOfferUpdated }) => {
  const navigate = useNavigate();

  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cuotas, setCuotas] = useState<number>(1);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showTests, setShowTests] = useState(false);

  const [isRevalidating, setIsRevalidating] = useState(false);
  const [priceChange, setPriceChange] = useState<{ anterior: MontoDto; nuevo: MontoDto } | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<unknown>(null);

  const brand = detectBrand(number);
  const errors: CardErrors = validateCard({ number, holder, expiry, cvv });
  const visibleError = (field: keyof CardErrors) => (touched[field] ? errors[field] : undefined);
  const hasErrors = Object.keys(errors).length > 0;

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

  const touch = (field: string) => setTouched((current) => ({ ...current, [field]: true }));

  const fillTestNumber = (value: string) => {
    setNumber(formatCardNumber(value));
    setHolder((current) => current || 'PRUEBA RAM');
    setExpiry((current) => current || `12/${String((new Date().getFullYear() + 3) % 100).padStart(2, '0')}`);
    setCvv((current) => current || (detectBrand(value) === 'AMEX' ? '1234' : '123'));
    setTouched({});
    setPaymentError(null);
  };

  const handlePay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isPaying) return;
    setTouched({ number: true, holder: true, expiry: true, cvv: true });
    if (hasErrors) return;

    const choice = resolveGatewayChoice(number);
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
      setNumber('');
      setCvv('');
      setHolder('');
      setExpiry('');
      onSuccess(orden);
    } catch (error) {
      setPaymentError(error);
      const problem = error instanceof ProblemDetailsError ? error : null;

      // A rejected payment is a stored outcome of that attempt: the next one needs a new key.
      if (problem && (problem.status === 402 || problem.code === 'ISSUANCE_FAILED_COMPENSATED')) {
        newAttempt();
        lastSignatureRef.current = '';
      }
      setCvv('');

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
          onCancel={() => navigate('/')}
        />
      )}

      {paymentError != null && <ProblemAlert error={paymentError} title="No se pudo completar el pago" className="mb-2" />}

      {blockedBySecurity && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span>Si ya intentaste pagar varias veces con esta reserva, el control de seguridad la bloquea. Empieza de nuevo con una búsqueda nueva.</span>
          <button type="button" onClick={() => navigate('/')} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-black px-4 py-2 font-bold text-white hover:bg-brand-navy">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Nueva búsqueda
          </button>
        </div>
      )}

      <form onSubmit={handlePay} noValidate autoComplete="off" className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pago con tarjeta</h3>
            <p className="text-xs text-slate-500">Aceptamos Visa, Mastercard, American Express y Diners Club.</p>
          </div>
          <AcceptedBrands active={brand} brands={ACCEPTED_BRANDS} />
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-brand-gold/40 bg-brand-gold-light p-3 text-xs text-slate-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold-dark" aria-hidden="true" />
          <p>
            <strong className="text-brand-black">Pago simulado.</strong> Puedes escribir cualquier número de tarjeta válido: <strong>los datos no se envían ni se guardan</strong> y no se cobra dinero.
          </p>
        </div>

        <div>
          <label htmlFor="card-number" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
            Número de tarjeta
          </label>
          <div className="relative">
            <input
              id="card-number"
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={number}
              onChange={(event) => setNumber(formatCardNumber(event.target.value))}
              onBlur={() => touch('number')}
              aria-invalid={Boolean(visibleError('number'))}
              aria-describedby="card-number-msg"
              className={`${fieldClass(visibleError('number'))} pr-16 font-mono tracking-wider`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-200">
              <CardBrandLogo brand={brand} className="h-6 w-10" />
            </span>
          </div>
          <p id="card-number-msg" className={`mt-1 min-h-[1rem] text-xs ${visibleError('number') ? 'font-medium text-red-600' : 'text-slate-500'}`} role={visibleError('number') ? 'alert' : undefined}>
            {visibleError('number') ?? (brand && brand !== 'UNSUPPORTED' ? `Tarjeta ${BRAND_NAMES[brand]}` : '')}
          </p>
        </div>

        <div>
          <label htmlFor="card-holder" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
            Nombre en la tarjeta
          </label>
          <input
            id="card-holder"
            type="text"
            autoComplete="cc-name"
            placeholder="COMO APARECE EN LA TARJETA"
            value={holder}
            onChange={(event) => setHolder(event.target.value.toUpperCase())}
            onBlur={() => touch('holder')}
            aria-invalid={Boolean(visibleError('holder'))}
            className={`${fieldClass(visibleError('holder'))} uppercase`}
          />
          {visibleError('holder') && (
            <p className="mt-1 text-xs font-medium text-red-600" role="alert">
              {visibleError('holder')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="card-expiry" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
              Vencimiento
            </label>
            <input
              id="card-expiry"
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              maxLength={5}
              value={expiry}
              onChange={(event) => setExpiry(formatExpiry(event.target.value))}
              onBlur={() => touch('expiry')}
              aria-invalid={Boolean(visibleError('expiry'))}
              className={`${fieldClass(visibleError('expiry'))} font-mono`}
            />
            {visibleError('expiry') && (
              <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                {visibleError('expiry')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="card-cvv" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
              Código de seguridad
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="card-cvv"
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder={'•'.repeat(cvvLength(brand))}
                maxLength={cvvLength(brand)}
                value={cvv}
                onChange={(event) => setCvv(onlyDigits(event.target.value).slice(0, cvvLength(brand)))}
                onBlur={() => touch('cvv')}
                aria-invalid={Boolean(visibleError('cvv'))}
                className={`${fieldClass(visibleError('cvv'))} pl-9 font-mono`}
              />
            </div>
            {visibleError('cvv') && (
              <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                {visibleError('cvv')}
              </p>
            )}
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="cuotas" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
              Cuotas
            </label>
            <select id="cuotas" value={cuotas} onChange={(event) => setCuotas(Number(event.target.value))} className={fieldClass()}>
              {availableCuotas.map((c) => (
                <option key={c} value={c}>
                  {c === 1 ? 'Pago en 1 cuota' : `${c} cuotas`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <button type="button" onClick={() => setShowTests((value) => !value)} className="font-bold text-brand-gold-dark underline underline-offset-2" aria-expanded={showTests}>
            {showTests ? 'Ocultar tarjetas de prueba' : 'Ver tarjetas de prueba'}
          </button>
          {showTests && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-2 text-slate-600">Números válidos que se aprueban (toca uno para rellenar):</p>
                <div className="flex flex-wrap gap-2">
                  {APPROVED_TEST_NUMBERS.map((entry) => (
                    <button
                      key={entry.brand}
                      type="button"
                      onClick={() => fillTestNumber(entry.number)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-[11px] hover:border-brand-gold"
                    >
                      <CardBrandLogo brand={entry.brand} className="h-4 w-7" />
                      {formatCardNumber(entry.number)}
                    </button>
                  ))}
                </div>
              </div>
              {SHOW_TEST_CARDS && (
                <div>
                  <p className="mb-2 text-slate-600">Números que simulan un problema:</p>
                  <div className="flex flex-wrap gap-2">
                    {TEST_NUMBERS.map((entry) => (
                      <button
                        key={entry.number}
                        type="button"
                        onClick={() => fillTestNumber(entry.number)}
                        className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-left text-[11px] hover:border-rose-400"
                      >
                        <span className="block font-mono">{formatCardNumber(entry.number)}</span>
                        <span className="text-slate-500">{entry.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-slate-500">Cualquier otro número válido (Visa, Mastercard, Amex o Diners) también se aprueba. Usa una fecha futura y cualquier código de seguridad.</p>
            </div>
          )}
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
