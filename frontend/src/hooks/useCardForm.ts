import { useState } from 'react';
import { formatCardNumber, resolveGatewayChoice, validateCard, detectBrand, type CardErrors, type GatewayChoice } from '../lib/cards';

/**
 * State of the (simulated) card fields. The typed number only lives here, in the browser: it is used to
 * recognise the brand and to pick the gateway token, and is NEVER sent, stored or logged.
 */
export function useCardForm() {
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors: CardErrors = validateCard({ number, holder, expiry, cvv });
  const valid = Object.keys(errors).length === 0;

  return {
    number,
    holder,
    expiry,
    cvv,
    setNumber,
    setHolder,
    setExpiry,
    setCvv,
    touched,
    touch: (field: string) => setTouched((current) => ({ ...current, [field]: true })),
    touchAll: () => setTouched({ number: true, holder: true, expiry: true, cvv: true }),
    errors,
    valid,
    /** The gateway token of the typed number, or null when the card is not valid / not sold. */
    choice: (): GatewayChoice | null => (valid ? resolveGatewayChoice(number) : null),
    fillTest: (value: string) => {
      setNumber(formatCardNumber(value));
      setHolder((current) => current || 'PRUEBA RAM');
      setExpiry((current) => current || `12/${String((new Date().getFullYear() + 3) % 100).padStart(2, '0')}`);
      setCvv((current) => current || (detectBrand(value) === 'AMEX' ? '1234' : '123'));
      setTouched({});
    },
    /** Wipes the card after a payment: nothing about it is kept. */
    wipe: () => {
      setNumber('');
      setHolder('');
      setExpiry('');
      setCvv('');
    },
  };
}

export type CardForm = ReturnType<typeof useCardForm>;
