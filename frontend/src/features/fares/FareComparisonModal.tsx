import React from 'react';
import { Plane, X } from 'lucide-react';
import { useTarifas } from '../../api/endpoints/catalog';
import type { FamiliaTarifariaDto, ItinerarioDto } from '../../api/types';
import { FareFamilyCard } from './FareFamilyCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProblemAlert } from '../../components/common/ProblemAlert';

export interface FareComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerario: ItinerarioDto | null;
  passengers?: { adt: number; chd: number; inf: number };
  onSelectFare: (itinerario: ItinerarioDto, familia: FamiliaTarifariaDto) => void;
}

export const FareComparisonModal: React.FC<FareComparisonModalProps> = ({
  isOpen,
  onClose,
  itinerario,
  passengers = { adt: 1, chd: 0, inf: 0 },
  onSelectFare,
}) => {
  const { data: tarifasData, isLoading, error, refetch } = useTarifas(
    itinerario?.itinerarioId,
    {
      adt: passengers.adt,
      chd: passengers.chd,
      inf: passengers.inf,
    }
  );

  if (!isOpen || !itinerario) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fare-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-5xl rounded-3xl bg-white shadow-2xl z-10 overflow-hidden my-auto border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-brand-black text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-gold mb-1">
              <Plane className="w-4 h-4 -rotate-45" />
              <span>Vuelo {itinerario.numeroVuelo} · {itinerario.operador?.nombre}</span>
            </div>
            <h3 id="fare-modal-title" className="text-xl sm:text-2xl font-black">
              Selecciona tu tarifa: {itinerario.origen.ciudad} ({itinerario.origen.iata}) a{' '}
              {itinerario.destino.ciudad} ({itinerario.destino.iata})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-7 overflow-y-auto">
          {error != null && (
            <div className="mb-6">
              <ProblemAlert error={error} onRetry={() => refetch()} />
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-slate-200 p-5 space-y-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-10 w-36" />
                  <div className="space-y-3 pt-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                  <Skeleton className="h-11 w-full rounded-xl mt-6" />
                </div>
              ))}
            </div>
          ) : tarifasData && tarifasData.familias ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(tarifasData.familias as unknown as FamiliaTarifariaDto[]).map((fam) => (
                  <FareFamilyCard
                    key={fam.codigo}
                    familia={fam}
                    onSelect={(f) => onSelectFare(itinerario, f)}
                  />
                ))}
              </div>

              {tarifasData.vigenteHasta && (
                <p className="mt-6 text-center text-xs text-slate-400">
                  Cotización válida hasta:{' '}
                  {new Date(tarifasData.vigenteHasta).toLocaleTimeString('es-EC')}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
