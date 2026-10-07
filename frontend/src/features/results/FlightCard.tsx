import React from 'react';
import { Plane, ArrowRight, AlertTriangle, Sparkles, Zap, Award } from 'lucide-react';
import type { ItinerarioDto } from '../../api/types';
import { formatTimeInTimeZone, formatDuration } from '../../lib/dates';
import { MoneyText } from '../../components/common/MoneyText';
import { timeZoneOf } from '../../lib/airports';
import { fareFamilyLabel } from '../../lib/labels';
import { Button } from '../../components/ui/Button';

export interface FlightCardProps {
  itinerario: ItinerarioDto;
  originTimeZone?: string;
  destTimeZone?: string;
  onSelect: (itinerario: ItinerarioDto) => void;
  isSelected?: boolean;
}

export const FlightCard: React.FC<FlightCardProps> = ({
  itinerario,
  originTimeZone = timeZoneOf(itinerario.origen.iata),
  destTimeZone = timeZoneOf(itinerario.destino.iata),
  onSelect,
  isSelected = false,
}) => {
  const departureTime = formatTimeInTimeZone(itinerario.salida, originTimeZone);
  const arrivalTime = formatTimeInTimeZone(itinerario.llegada, destTimeZone);
  const duration = formatDuration(itinerario.duracionMinutos);

  return (
    <div
      className={`rounded-2xl border bg-white p-5 sm:p-6 transition-all duration-200 ${
        isSelected
          ? 'border-brand-gold ring-2 ring-brand-gold shadow-card-hover'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-card'
      }`}
    >
      {/* Badges / Distintivos header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {itinerario.distintivos?.includes('RECOMENDADO') && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              <Award className="w-3.5 h-3.5" aria-hidden="true" /> Recomendado
            </span>
          )}
          {itinerario.distintivos?.includes('MAS_ECONOMICO') && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Más económico
            </span>
          )}
          {itinerario.distintivos?.includes('MAS_RAPIDO') && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
              <Zap className="w-3.5 h-3.5" aria-hidden="true" /> Más rápido
            </span>
          )}
        </div>

        {/* Scarcity badge */}
        {itinerario.ultimosAsientos && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Últimos asientos a este precio
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Flight Time Schedule */}
        <div className="flex-1 flex items-center justify-between sm:justify-start sm:gap-8">
          {/* Departure */}
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-sans">
              {departureTime}
            </div>
            <div className="font-mono text-xs font-bold text-brand-black mt-0.5">
              {itinerario.origen.iata}
            </div>
            <div className="text-xs text-slate-500 truncate max-w-[120px]">
              {itinerario.origen.ciudad}
            </div>
          </div>

          {/* Duration Graphic */}
          <div className="flex flex-col items-center px-2">
            <span className="text-xs font-semibold text-slate-500 mb-1">{duration}</span>
            <div className="relative w-24 sm:w-36 flex items-center">
              <div className="w-2 h-2 rounded-full bg-brand-black" />
              <div className="flex-1 border-b-2 border-dashed border-slate-300 mx-1" />
              <Plane className="w-4 h-4 text-brand-gold shrink-0 -rotate-45" aria-hidden="true" />
              <div className="flex-1 border-b-2 border-dashed border-slate-300 mx-1" />
              <div className="w-2 h-2 rounded-full bg-brand-black" />
            </div>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1.5">
              Directo
            </span>
            {itinerario.cruceDeDia && (
              <span className="text-[10px] text-amber-700 font-bold mt-0.5">+1 día</span>
            )}
          </div>

          {/* Arrival */}
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-sans">
              {arrivalTime}
            </div>
            <div className="font-mono text-xs font-bold text-brand-black mt-0.5">
              {itinerario.destino.iata}
            </div>
            <div className="text-xs text-slate-500 truncate max-w-[120px]">
              {itinerario.destino.ciudad}
            </div>
          </div>
        </div>

        {/* Flight Operator Details */}
        <div className="text-xs text-slate-500 border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-6 flex flex-row lg:flex-col justify-between lg:justify-center">
          <div>
            <span className="font-semibold text-slate-700">Vuelo {itinerario.numeroVuelo}</span>
            <div className="text-slate-500">
              Operado por {itinerario.operador?.nombre}
            </div>
          </div>
          <div className="lg:mt-1">
            <span className="text-slate-400">Tarifa desde: </span>
            <span className="font-semibold text-slate-700">{fareFamilyLabel(itinerario.familiaDesde)}</span>
          </div>
        </div>

        {/* Price & Selection Action */}
        <div className="flex items-center justify-between lg:flex-col lg:items-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <div className="text-left lg:text-right">
            <span className="text-xs text-slate-500 block">Precio por adulto desde</span>
            <div className="text-brand-black">
              <MoneyText
                amount={itinerario.precioDesde?.monto}
                currency={itinerario.precioDesde?.moneda}
                size="2xl"
              />
            </div>
            <span className="text-[11px] text-slate-400">Tasas e impuestos incluidos</span>
          </div>

          <Button
            variant={isSelected ? 'secondary' : 'primary'}
            onClick={() => onSelect(itinerario)}
            className="px-6 py-2.5 font-bold shadow-sm bg-brand-black hover:bg-slate-900 text-brand-gold border border-brand-gold/30"
          >
            <span>{isSelected ? 'Seleccionado' : 'Elegir vuelo'}</span>
            <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
};
