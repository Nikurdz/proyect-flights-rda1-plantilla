import React from 'react';
import { Users, FileText, ShieldCheck, CreditCard, Check } from 'lucide-react';

export type CheckoutStep = 'pasajeros' | 'facturacion' | 'condiciones' | 'pago';

interface CheckoutStepperProps {
  currentStep: CheckoutStep;
  completedSteps: CheckoutStep[];
  onStepClick?: (step: CheckoutStep) => void;
}

export const CheckoutStepper: React.FC<CheckoutStepperProps> = ({
  currentStep,
  completedSteps,
  onStepClick,
}) => {
  const steps: { id: CheckoutStep; label: string; icon: React.ElementType }[] = [
    { id: 'pasajeros', label: '1. Pasajeros y Contacto', icon: Users },
    { id: 'facturacion', label: '2. Facturación', icon: FileText },
    { id: 'condiciones', label: '3. Condiciones Legales', icon: ShieldCheck },
    { id: 'pago', label: '4. Pago Seguro', icon: CreditCard },
  ];

  const getStepIndex = (stepId: CheckoutStep) => steps.findIndex((s) => s.id === stepId);
  const currentIndex = getStepIndex(currentStep);

  return (
    <nav aria-label="Progreso de compra" className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm mb-6">
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {steps.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStep;
          const isPast = idx < currentIndex;
          const isClickable = (isCompleted || isPast) && Boolean(onStepClick);
          const Icon = step.icon;

          return (
            <li key={step.id} className="relative">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.id)}
                disabled={!isClickable && !isCurrent}
                className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                  isCurrent
                    ? 'bg-airline-navy text-white font-bold shadow-sm'
                    : isCompleted || isPast
                    ? 'text-slate-700 hover:bg-slate-50 cursor-pointer font-medium'
                    : 'text-slate-400 cursor-not-allowed opacity-75'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                    isCurrent
                      ? 'bg-airline-gold text-airline-navy font-black'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="block text-xs truncate leading-tight">{step.label}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
