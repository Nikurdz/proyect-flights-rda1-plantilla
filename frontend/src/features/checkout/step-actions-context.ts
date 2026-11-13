import { createContext } from 'react';

/** Id every step form carries, so the bar of a phone can submit it from outside the form. */
export const CHECKOUT_FORM_ID = 'checkout-step-form';

/** Where the primary action goes on a phone: the fixed bar at the bottom (set by the page). */
export const CheckoutBarContext = createContext<HTMLElement | null>(null);
