import React from 'react';
import { Luggage, Briefcase, RefreshCw, Undo2, Armchair } from 'lucide-react';
import type { FamiliaTarifariaDto } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';
import { Button } from '../../components/ui/Button';

export interface FareFamilyCardProps {
  familia: FamiliaTarifariaDto;
  onSelect: (familia: FamiliaTarifariaDto) => void;
  isPopular?: boolean;
}

export const FareFamilyCard: React.FC<FareFamilyCardProps> = ({
  familia,
  onSelect,
  isPopular = false,
}) => {
  const cond = familia.condiciones;

  const isFull = familia.codigo.toUpperCase() === 'FULL';
  const isLight = familia.codigo.toUpperCase() === 'LIGHT';

  return (
    <div
      className={`rounded-2xl border bg-white flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
        isPopular || isLight
          ? 'border-airline-blue shadow-card-hover ring-2 ring-airline-blue/20'
          : 'border-slate-200 shadow-card hover:border-slate-300'
      }`}
    >
      {/* Popular badge */}
      {(isPopular || isLight) && (
        <div className="bg-airline-blue text-white text-[11px] font-bold text-center py-1 uppercase tracking-wider">
          Más conveniente
        </div>
      )}

      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-lg font-black text-airline-navy tracking-tight uppercase">
            {familia.nombre || familia.codigo}
          </h4>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
            Economy
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {familia.asientosDisponibles} asientos disponibles
        </p>

        {/* Total price for the group */}
        <div className="mt-4 pt-3 border-t border-slate-200/60">
          <span className="text-xs text-slate-500 block">Total del grupo</span>
          <div className="text-airline-navy">
            <MoneyText
              amount={familia.totalGrupo?.monto}
              currency={familia.totalGrupo?.moneda}
              size="2xl"
            />
          </div>
          <span className="text-[11px] text-slate-400">Tasas e impuestos incluidos</span>
        </div>
      </div>

      {/* Benefits List */}
      <div className="p-5 flex-1 space-y-3.5 text-xs text-slate-700">
        {/* Hand Luggage */}
        <div className="flex items-start gap-2.5">
          <Briefcase className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Equipaje de mano</span>
            {cond?.equipajeMano?.incluido ? (
              <span className="text-emerald-700 font-medium">
                Incluido ({cond.equipajeMano.kg} kg en cabina)
              </span>
            ) : (
              <span className="text-slate-400">Solo artículo personal</span>
            )}
          </div>
        </div>

        {/* Hold Luggage */}
        <div className="flex items-start gap-2.5">
          <Luggage className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Equipaje de bodega</span>
            {cond?.equipajeBodega?.piezas && cond.equipajeBodega.piezas > 0 ? (
              <span className="text-emerald-700 font-medium">
                {cond.equipajeBodega.piezas} pieza(s) de 23 kg incluida
              </span>
            ) : (
              <span className="text-slate-400">No incluido</span>
            )}
          </div>
        </div>

        {/* Changes */}
        <div className="flex items-start gap-2.5">
          <RefreshCw className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Cambios de fecha</span>
            {cond?.cambio?.permitido ? (
              <span className="text-emerald-700 font-medium">Permitido (aplica cargo/diferencia)</span>
            ) : (
              <span className="text-slate-400">No permitido</span>
            )}
          </div>
        </div>

        {/* Refunds */}
        <div className="flex items-start gap-2.5">
          <Undo2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Devolución / Reembolso</span>
            {cond?.devolucion?.permitida ? (
              <span className="text-emerald-700 font-medium">Reembolso permitido</span>
            ) : (
              <span className="text-slate-400">No reembolsable</span>
            )}
          </div>
        </div>

        {/* Seat Selection */}
        <div className="flex items-start gap-2.5">
          <Armchair className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Selección de asiento</span>
            {cond?.seleccionAsiento?.incluida ? (
              <span className="text-emerald-700 font-medium">Asiento estándar incluido</span>
            ) : (
              <span className="text-slate-400">No incluida</span>
            )}
          </div>
        </div>
      </div>

      {/* Select button */}
      <div className="p-5 pt-0">
        <Button
          variant={isFull ? 'accent' : isPopular || isLight ? 'secondary' : 'outline'}
          size="md"
          onClick={() => onSelect(familia)}
          className="w-full font-bold shadow-sm"
        >
          Elegir {familia.nombre || familia.codigo}
        </Button>
      </div>
    </div>
  );
};
