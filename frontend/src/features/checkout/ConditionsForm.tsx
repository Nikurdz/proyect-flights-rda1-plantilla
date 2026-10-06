import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, ArrowLeft, ExternalLink, FileText } from 'lucide-react';
import { useMercado } from '../../api/endpoints/markets';
import { aceptarCondiciones } from '../../api/endpoints/offers';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import type { OfertaViewDto, AceptarCondicionesDto } from '../../api/types';

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
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Condiciones del Contrato de Viaje</h3>
            <p className="text-xs text-slate-500">
              Revisa y acepta los términos para proceder al pago seguro de tu reserva.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {/* Terminos y Condiciones */}
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-black focus:ring-brand-gold"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">
                  Acepto los Términos y Condiciones Generales {versionTerminos ? `(versión ${versionTerminos})` : ''} *
                </span>
                <span className="text-slate-500 block mt-0.5">
                  Declaro conocer las reglas de reserva, cambios y reembolsos de la tarifa elegida.
                </span>
                <Link
                  to="/terminos"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-gold-dark hover:underline mt-1.5"
                >
                  <FileText className="w-3 h-3" />
                  <span>Leer los Términos de uso (se abre en otra pestaña)</span>
                </Link>
              </div>
            </label>
          </div>

          {/* Contrato de Transporte */}
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptCarriage}
                onChange={(e) => setAcceptCarriage(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-black focus:ring-brand-gold"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">
                  Acepto las Condiciones del Contrato de Transporte Aéreo {versionCondiciones ? `(versión ${versionCondiciones})` : ''} *
                </span>
                <span className="text-slate-500 block mt-0.5">
                  Equipaje, presentación en el aeropuerto, documentos de viaje y deberes del pasajero.
                </span>
                <Link
                  to="/condiciones-transporte"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-gold-dark hover:underline mt-1.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Leer las Condiciones de transporte (se abre en otra pestaña)</span>
                </Link>
              </div>
            </label>
          </div>

          {/* Declaración de Veracidad */}
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptDeclaration}
                onChange={(e) => setAcceptDeclaration(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-black focus:ring-brand-gold"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">
                  Declaración de veracidad de datos y documentación de viaje *
                </span>
                <span className="text-slate-500 block mt-0.5">
                  Confirmo que los nombres y números de documentos ingresados coinciden de forma exacta con los pasaportes o identificaciones oficiales de cada viajero.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
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
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

    </form>
  );
};
