import React from 'react';
import { Plane } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
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
    <Dialog
      isOpen
      onClose={onClose}
      variant="dark"
      maxWidth="5xl"
      eyebrow={
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-gold">
          <Plane className="w-4 h-4 -rotate-45" aria-hidden="true" />
          <span>Vuelo {itinerario.numeroVuelo} · {itinerario.operador?.nombre}</span>
        </div>
      }
      title={
        <>
          Selecciona tu tarifa: {itinerario.origen.ciudad} ({itinerario.origen.iata}) a{' '}
          {itinerario.destino.ciudad} ({itinerario.destino.iata})
        </>
      }
    >
        <div>
          {error != null && (
            <div className="mb-6">
              <ProblemAlert error={error} onRetry={() => refetch()} />
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5" role="status" aria-busy="true" aria-label="Cargando">
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
    </Dialog>
  );
};
