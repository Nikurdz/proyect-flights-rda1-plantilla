import React, { useState } from 'react';
import { Info, Lock } from 'lucide-react';
import type { CardForm } from '../../hooks/useCardForm';
import { AcceptedBrands, CardBrandLogo } from '../../components/ui/CardBrandLogo';
import { Input } from '../../components/ui/Input';
import { showTestCards } from '../../lib/checkout';
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

interface CardFieldsetProps {
  card: CardForm;
  idPrefix?: string;
  /** Extra controls after the card fields (the checkout adds the installments). */
  extra?: React.ReactNode;
}

/**
 * Card fields of the simulated gateway (same rules for the flight checkout and the experiences).
 * Only a token ever leaves the browser. The one legal notice of the simulated payment lives here.
 */
export const CardFieldset: React.FC<CardFieldsetProps> = ({ card, idPrefix = 'exp', extra }) => {
  const [showTests, setShowTests] = useState(false);
  const brand = detectBrand(card.number);
  const visible = (field: keyof CardErrors) => (card.touched[field] ? card.errors[field] : undefined);
  const testCards = showTestCards();

  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-3 text-lead font-semibold text-ink">
        <span>Pago con tarjeta</span>
        <AcceptedBrands active={brand} brands={ACCEPTED_BRANDS} />
      </legend>

      <div className="flex items-start gap-2.5 rounded-lg border border-gold-text/40 bg-gold-soft p-3 text-small text-ink">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-text" aria-hidden="true" />
        <p>
          <strong className="font-semibold">Pago de prueba: no se cobra ni se guardan los datos de tu tarjeta.</strong> Puedes escribir cualquier número de tarjeta válido.
        </p>
      </div>

      <Input
        label="Número de tarjeta"
        id={`${idPrefix}-number`}
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="0000 0000 0000 0000"
        value={card.number}
        onChange={(e) => card.setNumber(formatCardNumber(e.target.value))}
        onBlur={() => card.touch('number')}
        error={visible('number')}
        helperText={brand && brand !== 'UNSUPPORTED' ? `Tarjeta ${BRAND_NAMES[brand]}` : undefined}
        rightIcon={<CardBrandLogo brand={brand} className="h-6 w-10" />}
        className="num pr-16 tracking-wider"
      />

      <Input
        label="Nombre en la tarjeta"
        id={`${idPrefix}-holder`}
        autoComplete="cc-name"
        placeholder="Como aparece en la tarjeta"
        value={card.holder}
        onChange={(e) => card.setHolder(e.target.value.toUpperCase())}
        onBlur={() => card.touch('holder')}
        error={visible('holder')}
        className="uppercase"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Vencimiento"
          id={`${idPrefix}-expiry`}
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM/AA"
          maxLength={5}
          value={card.expiry}
          onChange={(e) => card.setExpiry(formatExpiry(e.target.value))}
          onBlur={() => card.touch('expiry')}
          error={visible('expiry')}
          className="num"
        />
        <Input
          label="Código de seguridad"
          id={`${idPrefix}-cvv`}
          type="password"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder={'•'.repeat(cvvLength(brand))}
          maxLength={cvvLength(brand)}
          value={card.cvv}
          onChange={(e) => card.setCvv(onlyDigits(e.target.value).slice(0, cvvLength(brand)))}
          onBlur={() => card.touch('cvv')}
          error={visible('cvv')}
          leftIcon={<Lock className="h-4 w-4" />}
          className="num"
        />
      </div>

      {extra}

      {testCards && (
        <div className="rounded-lg border border-line bg-paper p-3 text-small">
          <button type="button" onClick={() => setShowTests((v) => !v)} className="min-h-[24px] font-medium text-gold-text underline underline-offset-2" aria-expanded={showTests}>
            {showTests ? 'Ocultar tarjetas de prueba' : 'Ver tarjetas de prueba'}
          </button>
          {showTests && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-2 text-muted">Números que se aprueban (toca uno para rellenar):</p>
                <div className="flex flex-wrap gap-2">
                  {APPROVED_TEST_NUMBERS.map((entry) => (
                    <button
                      key={entry.brand}
                      type="button"
                      onClick={() => card.fillTest(entry.number)}
                      className="num inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs hover:border-gold-text sm:min-h-0"
                    >
                      <CardBrandLogo brand={entry.brand} className="h-4 w-7" />
                      {formatCardNumber(entry.number)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-muted">Números que simulan un problema:</p>
                <div className="flex flex-wrap gap-2">
                  {TEST_NUMBERS.map((entry) => (
                    <button
                      key={entry.number}
                      type="button"
                      onClick={() => card.fillTest(entry.number)}
                      className="min-h-[44px] rounded-lg border border-danger/40 bg-surface px-2.5 py-1.5 text-left text-xs hover:border-danger sm:min-h-0"
                    >
                      <span className="num block">{formatCardNumber(entry.number)}</span>
                      <span className="text-muted">{entry.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
};
