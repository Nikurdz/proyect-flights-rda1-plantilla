import React, { useContext, useId } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { CHECKOUT_FORM_ID, CheckoutBarContext } from './step-actions-context';


export interface StepActionsProps {
  submitLabel: string;
  /** Label while the step is saving ("Guardando…"). */
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Why the action is disabled: shown next to the button and linked with `aria-describedby`. */
  reason?: string;
  variant?: 'primary' | 'accent';
  icon?: React.ReactNode;
  backLabel?: string;
  onBack?: () => void;
  backDisabled?: boolean;
}

/**
 * Back + primary action of a checkout step. On a desktop both sit at the end of the form; on a phone
 * the primary action moves to the fixed bar (with the total and the countdown) and still submits the form.
 */
export const StepActions: React.FC<StepActionsProps> = ({ submitLabel, loadingLabel, loading, disabled, reason, variant = 'primary', icon, backLabel, onBack, backDisabled }) => {
  const slot = useContext(CheckoutBarContext);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const reasonId = useId();
  const showReason = Boolean(reason) && Boolean(disabled) && !loading;

  const primary = (
    <Button
      type="submit"
      form={CHECKOUT_FORM_ID}
      variant={variant}
      size="lg"
      isLoading={loading}
      disabled={disabled}
      aria-describedby={showReason ? reasonId : undefined}
      className="w-full sm:w-auto"
    >
      {loading ? (loadingLabel ?? submitLabel) : (
        <>
          {icon}
          {submitLabel}
        </>
      )}
    </Button>
  );

  const inBar = !isDesktop && slot;

  return (
    <div className="space-y-3 pt-2">
      {showReason && (
        <p id={reasonId} className="text-sm text-muted sm:text-right">
          {reason}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onBack ? (
          <Button type="button" variant="outline" size="lg" onClick={onBack} disabled={backDisabled} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            {backLabel ?? 'Volver'}
          </Button>
        ) : (
          <span />
        )}
        {inBar ? createPortal(primary, slot) : primary}
      </div>
    </div>
  );
};
