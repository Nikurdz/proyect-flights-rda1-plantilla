import React from 'react';
import { AlertTriangle, Ban, Clock, Star, Wallet } from 'lucide-react';
import type { ItinerarioDto } from '../../api/types';
import { formatTimeInTimeZone, formatDuration } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { groupTotalFromAdultPrice, type GroupCounts } from '../../lib/best-value';
import { describePassengers } from '../../lib/search';
import { timeZoneOf } from '../../lib/airports';
import { fareFamilyLabel, formatShortDay } from '../../lib/labels';
import { Badge } from '../../components/ui/Badge';
import { BoardingPass } from '../../components/ui/BoardingPass';
import { Button } from '../../components/ui/Button';

export interface FlightCardProps {
  itinerario: ItinerarioDto;
  originTimeZone?: string;
  destTimeZone?: string;
  onSelect: (itinerario: ItinerarioDto) => void;
  isSelected?: boolean;
  /** Passengers that need a seat (adults + youths + children), to word the sold-out notice. */
  passengerCount?: number;
  /** The searched party, to show the total of the group next to the price per adult. */
  group?: GroupCounts;
  /** The flight with the lowest total of the list: «Más conveniente». */
  bestValue?: boolean;
  /** The single strictly fastest flight of the list (no badge on a tie). */
  fastest?: boolean;
  /** The single recommended flight of the list. */
  recommended?: boolean;
}

export const FlightCard: React.FC<FlightCardProps> = ({
  itinerario,
  originTimeZone = timeZoneOf(itinerario.origen.iata),
  destTimeZone = timeZoneOf(itinerario.destino.iata),
  onSelect,
  isSelected = false,
  passengerCount = 1,
  group = { adt: 1, yth: 0, chd: 0, inf: 0 },
  bestValue = false,
  fastest = false,
  recommended = false,
}) => {
  const soldOut = itinerario.agotado === true;
  const departureTime = formatTimeInTimeZone(itinerario.salida, originTimeZone);
  const arrivalTime = formatTimeInTimeZone(itinerario.llegada, destTimeZone);
  const duration = formatDuration(itinerario.duracionMinutos);
  const currency = itinerario.precioDesde?.moneda;
  const perAdult = formatMoney(itinerario.precioDesde?.monto, currency);
  const groupTotal = groupTotalFromAdultPrice(itinerario.precioDesde?.monto, group);
  const multiple = group.adt + group.yth + group.chd + group.inf > 1;
  const stops = itinerario.escalas > 0 ? `${itinerario.escalas} ${itinerario.escalas === 1 ? 'escala' : 'escalas'}` : 'Directo';
  const operator = (itinerario.operador as { nombre?: string } | undefined)?.nombre;
  // Short day («sáb 14 nov») so the line under the departure time is not truncated on a phone.
  const dayLabel = formatShortDay(itinerario.salida, originTimeZone);

  const details = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {bestValue && !soldOut && (
          <Badge variant="secondary" icon={<Wallet />}>
            Más conveniente
          </Badge>
        )}
        {recommended && !soldOut && (
          <Badge variant="warning" icon={<Star />}>
            Recomendado
          </Badge>
        )}
        {fastest && !soldOut && (
          <Badge variant="outline" icon={<Clock />}>
            Más rápido
          </Badge>
        )}
        {soldOut && (
          <Badge variant="primary" icon={<Ban />}>
            Agotado
          </Badge>
        )}
        {!soldOut && itinerario.ultimosAsientos && (
          <Badge variant="danger" icon={<AlertTriangle />}>
            Últimos asientos a este precio
          </Badge>
        )}
        {itinerario.cruceDeDia && <Badge variant="outline">Llega al día siguiente</Badge>}
      </div>
      <p>
        {stops} · Vuelo {itinerario.numeroVuelo}
        {operator ? ` · ${operator}` : ''} · Tarifa desde {fareFamilyLabel(itinerario.familiaDesde)}
      </p>
    </div>
  );

  const stub = soldOut ? (
    <div>
      <p className="text-body font-semibold text-ink">Agotado</p>
      <p className="mt-1 text-small text-muted">
        {passengerCount > 1 ? `Sin asientos para ${passengerCount} pasajeros en este vuelo.` : 'Sin asientos disponibles en este vuelo.'}
      </p>
    </div>
  ) : (
    <>
      <div>
        <p className="text-small text-muted">Por adulto, desde</p>
        <p className="num text-title font-semibold text-ink">{perAdult}</p>
        {multiple &&
          (groupTotal !== null ? (
            <p className="num mt-1 text-small text-ink">
              <span className="font-semibold">{formatMoney(groupTotal, currency)}</span>
              <span className="text-muted"> en total para {describePassengers(group)}</span>
            </p>
          ) : (
            <p className="mt-1 text-small text-muted">El total de tu grupo se calcula al elegir la tarifa.</p>
          ))}
        <p className="mt-1 text-small text-muted">Impuestos incluidos</p>
      </div>
      <Button
        variant={isSelected ? 'secondary' : 'primary'}
        onClick={() => onSelect(itinerario)}
        className="w-full"
        aria-label={`Elegir vuelo ${itinerario.numeroVuelo}, ${departureTime}`}
      >
        {isSelected ? 'Elegido' : 'Elegir'}
      </Button>
    </>
  );

  return (
    <div aria-disabled={soldOut || undefined} className={soldOut ? 'opacity-70' : undefined}>
      <BoardingPass
        ariaLabel={`Vuelo ${itinerario.numeroVuelo} de ${itinerario.origen.ciudad} a ${itinerario.destino.ciudad}`}
        origin={{ code: itinerario.origen.iata, city: itinerario.origen.ciudad, time: departureTime, date: dayLabel }}
        destination={{ code: itinerario.destino.iata, city: itinerario.destino.ciudad, time: arrivalTime }}
        duration={duration}
        details={details}
        stub={stub}
        className={isSelected ? 'border-gold-text ring-2 ring-gold-text/40' : undefined}
      />
    </div>
  );
};
