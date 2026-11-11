import React, { useState } from 'react';
import { Info, Lock } from 'lucide-react';
import type { CardForm } from '../../hooks/useCardForm';
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
  type CardErrors,
} from '../../lib/cards';

const SHOW_TEST_CARDS = import.meta.env.VITE_SHOW_TEST_CARDS === 'true';

const fieldClass = (error?: string) =>
  `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
    error ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-brand-gold focus:ring-brand-gold/20'
  }`;

const labelClass = 'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700';

/** Card fields of the simulated gateway (same rules as the flight checkout). Only a token ever leaves the browser. */
export const CardFieldset: React.FC<{ card: CardForm; idPrefix?: string }> = ({ card, idPrefix = 'exp' }) => {
  const [showTests, setShowTests] = useState(false);
  const brand = detectBrand(card.number);
  const visible = (field: keyof CardErrors) => (card.touched[field] ? card.errors[field] : undefined);

  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-900">
        <span>Pago con tarjeta</span>
        <AcceptedBrands active={brand} brands={ACCEPTED_BRANDS} />
      </legend>

      <div className="flex items-start gap-2.5 rounded-xl border border-brand-gold/40 bg-brand-gold-light p-3 text-xs text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold-dark" aria-hidden="true" />
        <p>
          <strong className="text-brand-black">Pago simulado.</strong> Escribe cualquier número de tarjeta válido: <strong>los datos no se envían ni se guardan</strong> y no se cobra dinero.
        </p>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-number`} className={labelClass}>
          Número de tarjeta
        </label>
        <div className="relative">
          <input
            id={`${idPrefix}-number`}
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            value={card.number}
            onChange={(e) => card.setNumber(formatCardNumber(e.target.value))}
            onBlur={() => card.touch('number')}
            aria-invalid={Boolean(visible('number'))}
            aria-describedby={`${idPrefix}-number-msg`}
            className={`${fieldClass(visible('number'))} pr-16 font-mono tracking-wider`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <CardBrandLogo brand={brand} className="h-6 w-10" />
          </span>
        </div>
        <p id={`${idPrefix}-number-msg`} className={`mt-1 min-h-[1rem] text-xs ${visible('number') ? 'font-medium text-red-600' : 'text-slate-500'}`} role={visible('number') ? 'alert' : undefined}>
          {visible('number') ?? (brand && brand !== 'UNSUPPORTED' ? `Tarjeta ${BRAND_NAMES[brand]}` : '')}
        </p>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-holder`} className={labelClass}>
          Nombre en la tarjeta
        </label>
        <input
          id={`${idPrefix}-holder`}
          type="text"
          autoComplete="cc-name"
          placeholder="COMO APARECE EN LA TARJETA"
          value={card.holder}
          onChange={(e) => card.setHolder(e.target.value.toUpperCase())}
          onBlur={() => card.touch('holder')}
          aria-invalid={Boolean(visible('holder'))}
          aria-describedby={visible('holder') ? `${idPrefix}-holder-msg` : undefined}
          className={`${fieldClass(visible('holder'))} uppercase`}
        />
        {visible('holder') && (
          <p id={`${idPrefix}-holder-msg`} className="mt-1 text-xs font-medium text-red-600" role="alert">
            {visible('holder')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-expiry`} className={labelClass}>
            Vencimiento
          </label>
          <input
            id={`${idPrefix}-expiry`}
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/AA"
            maxLength={5}
            value={card.expiry}
            onChange={(e) => card.setExpiry(formatExpiry(e.target.value))}
            onBlur={() => card.touch('expiry')}
            aria-invalid={Boolean(visible('expiry'))}
            aria-describedby={visible('expiry') ? `${idPrefix}-expiry-msg` : undefined}
            className={`${fieldClass(visible('expiry'))} font-mono`}
          />
          {visible('expiry') && (
            <p id={`${idPrefix}-expiry-msg`} className="mt-1 text-xs font-medium text-red-600" role="alert">
              {visible('expiry')}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${idPrefix}-cvv`} className={labelClass}>
            Código de seguridad
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id={`${idPrefix}-cvv`}
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder={'•'.repeat(cvvLength(brand))}
              maxLength={cvvLength(brand)}
              value={card.cvv}
              onChange={(e) => card.setCvv(onlyDigits(e.target.value).slice(0, cvvLength(brand)))}
              onBlur={() => card.touch('cvv')}
              aria-invalid={Boolean(visible('cvv'))}
              aria-describedby={visible('cvv') ? `${idPrefix}-cvv-msg` : undefined}
              className={`${fieldClass(visible('cvv'))} pl-9 font-mono`}
            />
          </div>
          {visible('cvv') && (
            <p id={`${idPrefix}-cvv-msg`} className="mt-1 text-xs font-medium text-red-600" role="alert">
              {visible('cvv')}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
        <button type="button" onClick={() => setShowTests((v) => !v)} className="font-bold text-brand-gold-dark underline underline-offset-2" aria-expanded={showTests}>
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
                    onClick={() => card.fillTest(entry.number)}
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
                    <button key={entry.number} type="button" onClick={() => card.fillTest(entry.number)} className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-left text-[11px] hover:border-rose-400">
                      <span className="block font-mono">{formatCardNumber(entry.number)}</span>
                      <span className="text-slate-500">{entry.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </fieldset>
  );
};
