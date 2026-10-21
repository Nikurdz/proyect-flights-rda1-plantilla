import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, RefreshCw, XCircle } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { aceptarPrecio } from '../../api/endpoints/offers';
import type { MontoDto, OfertaViewDto } from '../../api/types';

interface PriceChangedModalProps {
  isOpen: boolean;
  ofertaId: string;
  precioAnterior: MontoDto;
  precioNuevo: MontoDto;
  onAccepted: (updatedOferta: OfertaViewDto) => void;
  onCancel: () => void;
}

export const PriceChangedModal: React.FC<PriceChangedModalProps> = ({
  isOpen,
  ofertaId,
  precioAnterior,
  precioNuevo,
  onAccepted,
  onCancel,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const handleAccept = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await aceptarPrecio(ofertaId, {
        totalAceptado: precioNuevo.monto,
      });
      onAccepted(updated);
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={() => {}} title="Actualización de Tarifa en Tiempo Real">
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold block mb-1">El valor de tu viaje ha cambiado</span>
            Durante el proceso de reserva, la aerolínea actualizó la disponibilidad o tasas oficiales.
            Para mantener tus asientos garantizados y continuar al pago, confirma que aceptas el nuevo total.
          </div>
        </div>

        {error != null && <ProblemAlert error={error} className="mb-2" />}

        {/* Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Precio Anterior
            </span>
            <div className="line-through opacity-70">
              <MoneyText
                amount={precioAnterior.monto}
                currency={precioAnterior.moneda}
                size="md"
                className="text-slate-500 font-bold"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-airline-navy/5 border-2 border-airline-navy">
            <span className="text-[11px] font-bold text-airline-navy uppercase tracking-wider block mb-1">
              Nuevo Precio Actual
            </span>
            <MoneyText
              amount={precioNuevo.monto}
              currency={precioNuevo.moneda}
              size="lg"
              className="text-airline-navy font-black"
            />
          </div>
        </div>

        {/* Modal Actions: Escape and the close button are inert on purpose, so say that one option must be chosen. */}
        <p id="price-changed-choice" className="text-xs font-semibold text-slate-700">
          Debes elegir una opción para continuar: aceptar el nuevo precio o cancelar y buscar otro vuelo.
        </p>
        <div role="group" aria-labelledby="price-changed-choice" className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <XCircle className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Cancelar y buscar otro vuelo</span>
          </button>

          <button
            type="button"
            onClick={handleAccept}
            disabled={isSubmitting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-airline-navy text-white text-xs font-bold hover:bg-slate-900 transition-all shadow-md disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Confirmando...</span>
              </>
            ) : (
              <>
                <span>Aceptar nuevo precio</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
