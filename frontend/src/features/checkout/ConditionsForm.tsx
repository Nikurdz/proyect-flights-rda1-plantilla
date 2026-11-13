import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useMercado } from '../../api/endpoints/markets';
import { aceptarCondiciones } from '../../api/endpoints/offers';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Card } from '../../components/ui/Card';
import { StepActions } from './StepActions';
import { CHECKOUT_FORM_ID } from './step-actions-context';
import type { OfertaViewDto, AceptarCondicionesDto } from '../../api/types';

/**
 * One required checkbox. The label holds only the title (so the checkbox's name is short), the
 * explanation is its description, and the link to the full text sits outside the label so clicking
 * it never toggles the box.
 */
const ConditionItem: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  /** Secondary detail (the version of the text), shown small under the description. */
  detail?: string;
  link?: { to: string; label: string };
}> = ({ checked, onChange, title, description, detail, link }) => {
  const id = useId();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line p-4 transition-colors hover:border-line-strong">
      <input
        id={id}
        type="checkbox"
        aria-required="true"
        aria-describedby={`${id}-desc`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-line-strong accent-gold-text"
      />
      <div className="min-w-0 text-small">
        <label htmlFor={id} className="block cursor-pointer text-body font-medium text-ink">
          {title}
        </label>
        <p id={`${id}-desc`} className="mt-0.5 text-muted">
          {description}
          {detail && <span className="mt-1 block text-xs">{detail}</span>}
        </p>
        {link && (
          <Link to={link.to} target="_blank" className="mt-1.5 inline-flex min-h-[24px] items-center gap-1 font-medium text-gold-text underline-offset-2 hover:underline">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{link.label}</span>
          </Link>
        )}
      </div>
    </div>
  );
};

interface ConditionsFormProps {
  oferta: OfertaViewDto;
  onSuccess: (updatedOferta: OfertaViewDto) => void;
  onBack: () => void;
}

export const ConditionsForm: React.FC<ConditionsFormProps> = ({ oferta, onSuccess, onBack }) => {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptCarriage, setAcceptCarriage] = useState(false);
  const [acceptDeclaration, setAcceptDeclaration] = useState(false);

  const { data: mercadoData, isLoading: loadingMarket, error: marketError, refetch } = useMercado(oferta.mercado);

  // The versions the API will record come from the market: none is invented if it cannot be read.
  const versionTerminos = mercadoData?.textosLegales?.terminos?.version;
  const versionCondiciones = mercadoData?.textosLegales?.condicionesTransporte?.version;
  const versionsReady = Boolean(versionTerminos && versionCondiciones);

  const missing = [acceptTerms, acceptCarriage, acceptDeclaration].filter((accepted) => !accepted).length;

  // Why the button is disabled, in words: shown under the form and linked to the button.
  let reason: string | undefined;
  if (missing === 3) reason = 'Marca las 3 casillas para continuar.';
  else if (missing > 0) reason = `${missing === 1 ? 'Falta 1 casilla' : `Faltan ${missing} casillas`} por marcar para continuar.`;
  else if (loadingMarket) reason = 'Cargando las condiciones…';
  else if (!versionsReady) reason = 'No pudimos cargar las condiciones. Reintenta para continuar.';

  const canContinue = !reason;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: AceptarCondicionesDto = {
        versionTerminos: versionTerminos!,
        versionCondicionesTransporte: versionCondiciones!,
      };

      const updated = await aceptarCondiciones(oferta.ofertaId, payload);
      onSuccess(updated);
    } catch (err) {
      setSubmitError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form id={CHECKOUT_FORM_ID} onSubmit={handleSubmit} className="space-y-6">
      {submitError != null && <ProblemAlert error={submitError} />}
      {marketError != null && !mercadoData && (
        <ProblemAlert error={marketError} title="No pudimos cargar las condiciones" message="No se pudieron cargar las condiciones del viaje. Reintenta para continuar." onRetry={() => void refetch()} />
      )}

      <Card className="space-y-5 p-5 sm:p-6" role="group" aria-labelledby="conditions-title">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft text-gold-text" aria-hidden="true">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 id="conditions-title" className="text-lead font-semibold text-ink">
              Antes de pagar
            </h2>
            <p className="text-small text-muted">Lee y acepta estas condiciones para continuar con tu reserva.</p>
          </div>
        </div>

        <div className="space-y-3">
          <ConditionItem
            checked={acceptTerms}
            onChange={setAcceptTerms}
            title="Acepto los términos y condiciones generales"
            description="Declaro conocer las reglas de reserva, cambios y reembolsos de la tarifa elegida."
            detail={versionTerminos ? `Versión del texto: ${versionTerminos}` : undefined}
            link={{ to: '/terminos', label: 'Leer los términos de uso (se abre en otra pestaña)' }}
          />
          <ConditionItem
            checked={acceptCarriage}
            onChange={setAcceptCarriage}
            title="Acepto las condiciones del contrato de transporte aéreo"
            description="Equipaje, presentación en el aeropuerto, documentos de viaje y deberes del pasajero."
            detail={versionCondiciones ? `Versión del texto: ${versionCondiciones}` : undefined}
            link={{ to: '/condiciones-transporte', label: 'Leer las condiciones de transporte (se abre en otra pestaña)' }}
          />
          <ConditionItem
            checked={acceptDeclaration}
            onChange={setAcceptDeclaration}
            title="Confirmo que mis datos son verídicos"
            description="Los nombres y los números de documento coinciden de forma exacta con los documentos oficiales de cada viajero."
          />
        </div>
      </Card>

      <StepActions submitLabel="Continuar al pago" loading={isSubmitting} loadingLabel="Guardando…" disabled={!canContinue} reason={reason} backLabel="Volver a facturación" onBack={onBack} />
    </form>
  );
};
