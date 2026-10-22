import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, ArrowLeft, ExternalLink, FileText, type LucideIcon } from 'lucide-react';
import { useMercado } from '../../api/endpoints/markets';
import { aceptarCondiciones } from '../../api/endpoints/offers';
import { ProblemAlert } from '../../components/common/ProblemAlert';
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
  link?: { to: string; label: string; icon: LucideIcon };
}> = ({ checked, onChange, title, description, link }) => {
  const id = useId();
  const LinkIcon = link?.icon;
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors">
      <input
        id={id}
        type="checkbox"
        aria-required="true"
        aria-describedby={`${id}-desc`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-brand-black focus:ring-brand-gold"
      />
      <div className="text-xs">
        <label htmlFor={id} className="block cursor-pointer font-bold text-slate-900">
          {title} <span aria-hidden="true">*</span>
        </label>
        <p id={`${id}-desc`} className="mt-0.5 text-slate-600">
          {description}
        </p>
        {link && LinkIcon && (
          <Link
            to={link.to}
            target="_blank"
            className="mt-1.5 inline-flex min-h-[24px] items-center gap-1 text-xs font-bold text-brand-gold-dark hover:underline"
          >
            <LinkIcon className="w-3 h-3" aria-hidden="true" />
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

  const { data: mercadoData } = useMercado(oferta.mercado);

  // The versions the API will record come from the market: none is invented if it cannot be read.
  const versionTerminos = mercadoData?.textosLegales?.terminos?.version;
  const versionCondiciones = mercadoData?.textosLegales?.condicionesTransporte?.version;
  const versionsReady = Boolean(versionTerminos && versionCondiciones);

  const isAllAccepted = acceptTerms && acceptCarriage && acceptDeclaration && versionsReady;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllAccepted) return;

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError != null && <ProblemAlert error={submitError} className="mb-4" />}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-xl bg-airline-navy/5 text-airline-navy flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Condiciones del Contrato de Viaje</h3>
            <p className="text-xs text-slate-500">
              Revisa y acepta los términos para proceder al pago seguro de tu reserva.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <ConditionItem
            checked={acceptTerms}
            onChange={setAcceptTerms}
            title={`Acepto los Términos y Condiciones Generales${versionTerminos ? ` (versión ${versionTerminos})` : ''}`}
            description="Declaro conocer las reglas de reserva, cambios y reembolsos de la tarifa elegida."
            link={{ to: '/terminos', label: 'Leer los Términos de uso (se abre en otra pestaña)', icon: FileText }}
          />
          <ConditionItem
            checked={acceptCarriage}
            onChange={setAcceptCarriage}
            title={`Acepto las Condiciones del Contrato de Transporte Aéreo${versionCondiciones ? ` (versión ${versionCondiciones})` : ''}`}
            description="Equipaje, presentación en el aeropuerto, documentos de viaje y deberes del pasajero."
            link={{ to: '/condiciones-transporte', label: 'Leer las Condiciones de transporte (se abre en otra pestaña)', icon: ExternalLink }}
          />
          <ConditionItem
            checked={acceptDeclaration}
            onChange={setAcceptDeclaration}
            title="Declaración de veracidad de datos y documentación de viaje"
            description="Confirmo que los nombres y números de documentos ingresados coinciden de forma exacta con los pasaportes o identificaciones oficiales de cada viajero."
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Volver a Facturación</span>
        </button>

        <button
          type="submit"
          disabled={!isAllAccepted || isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-airline-navy text-white font-bold text-sm hover:bg-slate-900 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span>Aceptando condiciones...</span>
          ) : (
            <>
              <span>Continuar al pago</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

    </form>
  );
};
