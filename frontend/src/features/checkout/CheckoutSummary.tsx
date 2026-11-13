import React from 'react';
import { Users } from 'lucide-react';
import { BoardingPass } from '../../components/ui/BoardingPass';
import { Card } from '../../components/ui/Card';
import { MoneyText } from '../../components/common/MoneyText';
import { Countdown } from '../../components/common/Countdown';
import { timeZoneOf } from '../../lib/airports';
import { formatDateInTimeZone, formatDuration, formatTimeInTimeZone } from '../../lib/dates';
import { holdUntil } from '../../lib/checkout';
import { fareFamilyLabel } from '../../lib/labels';
import type { OfertaViewDto } from '../../api/types';

interface CheckoutSummaryProps {
  oferta: OfertaViewDto;
  onExpire?: () => void;
  /** Show the countdown here. On a phone the fixed bar shows it instead, so it is never announced twice. */
  showCountdown?: boolean;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({ oferta, onExpire, showCountdown = true }) => {
  const adt = oferta.pasajeros?.adultos || 0;
  const yth = oferta.pasajeros?.jovenes || 0;
  const chd = oferta.pasajeros?.ninos || 0;
  const inf = oferta.pasajeros?.infantes || 0;
  const until = holdUntil(oferta);

  const travellers = [
    plural(adt, 'adulto', 'adultos'),
    yth > 0 ? plural(yth, 'joven', 'jóvenes') : null,
    chd > 0 ? plural(chd, 'niño', 'niños') : null,
    inf > 0 ? plural(inf, 'infante en brazos', 'infantes en brazos') : null,
  ].filter(Boolean);

  return (
    <aside aria-label="Resumen de tu compra" className="space-y-3">
      {(oferta.trayectos ?? []).map((leg, index, all) => {
        const minutes = Math.round((new Date(leg.llegada).getTime() - new Date(leg.salida).getTime()) / 60000);
        const originZone = timeZoneOf(leg.origen);
        const destinationZone = timeZoneOf(leg.destino);
        return (
          <BoardingPass
            key={leg.itinerarioId ?? index}
            ariaLabel={`${all.length > 1 ? (index === 0 ? 'Ida' : 'Vuelta') + ': ' : ''}vuelo ${leg.numeroVuelo} de ${leg.origen} a ${leg.destino}`}
            origin={{ code: leg.origen, time: formatTimeInTimeZone(leg.salida, originZone), date: formatDateInTimeZone(leg.salida, originZone) }}
            destination={{ code: leg.destino, time: formatTimeInTimeZone(leg.llegada, destinationZone), date: formatDateInTimeZone(leg.llegada, destinationZone) }}
            duration={formatDuration(minutes)}
            details={
              <span>
                {all.length > 1 && <span className="font-medium text-ink">{index === 0 ? 'Ida' : 'Vuelta'}. </span>}
                Vuelo <span className="num">{leg.numeroVuelo}</span>, tarifa {fareFamilyLabel(leg.familia)}
              </span>
            }
          />
        );
      })}

      <Card className="space-y-4">
        <div className="flex items-start gap-2 text-small text-muted">
          <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {travellers.join(', ')}. Horas de Ecuador.
          </p>
        </div>

        <div className="border-t border-line pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="font-medium text-ink">Total del grupo</p>
              <p className="text-small text-muted">Tarifas e impuestos de todos los pasajeros, en dólares.</p>
            </div>
            <MoneyText amount={oferta.total?.monto} currency={oferta.total?.moneda || oferta.moneda} size="2xl" className="num shrink-0 text-ink" />
          </div>
        </div>

        {oferta.venceEn && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <p className="text-small text-muted">{until ? `Tu cupo está retenido hasta las ${until}.` : 'Tu cupo está retenido.'}</p>
            {showCountdown && <Countdown venceEn={oferta.venceEn} initialSeconds={oferta.segundosRestantes} onExpire={onExpire} />}
          </div>
        )}
      </Card>
    </aside>
  );
};
