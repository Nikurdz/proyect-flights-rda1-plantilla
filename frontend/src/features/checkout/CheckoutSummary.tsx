import React from 'react';
import { Plane, Users, Shield, Clock } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { fareFamilyLabel, formatDateTime } from '../../lib/labels';
import { timeZoneOf } from '../../lib/airports';
import { MoneyText } from '../../components/common/MoneyText';
import { Countdown } from '../../components/common/Countdown';
import type { OfertaViewDto } from '../../api/types';

interface CheckoutSummaryProps {
  oferta: OfertaViewDto;
  onExpire?: () => void;
}

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({ oferta, onExpire }) => {
  const adt = oferta.pasajeros?.adultos || 0;
  const chd = oferta.pasajeros?.ninos || 0;
  const inf = oferta.pasajeros?.infantes || 0;

  return (
    <aside aria-label="Resumen de compra" className="space-y-4">
      {/* Expiration Countdown Card */}
      {oferta.venceEn && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            <span className="text-xs font-bold text-slate-800">Tu cupo está retenido</span>
          </div>
          <Countdown
            venceEn={oferta.venceEn}
            initialSeconds={oferta.segundosRestantes}
            onExpire={onExpire}
          />
        </div>
      )}

      {/* Main Itinerary & Price Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="bg-gradient-to-r from-brand-dark to-brand-black p-4 text-white flex items-center justify-between border-b border-brand-gold/20">
          <Logo variant="icon" />
          <span className="text-xs font-black tracking-widest text-brand-gold uppercase">
            Resumen de viaje
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Flight Legs */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tu itinerario
            </h4>

            {oferta.trayectos?.map((trayecto, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-brand-gold" />
                    {trayecto.origen} → {trayecto.destino}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {trayecto.numeroVuelo}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 text-[11px]">
                  <span>Salida (hora local): {formatDateTime(trayecto.salida, timeZoneOf(trayecto.origen))}</span>
                  <span className="font-bold text-airline-navy bg-airline-navy/5 px-2 py-0.5 rounded uppercase">
                    Tarifa {fareFamilyLabel(trayecto.familia)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Passenger Composition */}
          <div className="pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-1">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Pasajeros:</span>
            </div>
            <div className="text-slate-500 pl-6 text-[11px] space-y-0.5">
              <div>• {adt} Adulto{adt > 1 ? 's' : ''}</div>
              {chd > 0 && <div>• {chd} Niño{chd > 1 ? 's' : ''}</div>}
              {inf > 0 && <div>• {inf} Infante{inf > 1 ? 's' : ''} en brazos</div>}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <p className="text-xs text-slate-500">El total incluye la tarifa y los impuestos de todos los pasajeros.</p>

            <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Total a pagar</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Dólares (USD)</span>
              </div>
              <div className="text-right">
                <MoneyText
                  amount={oferta.total?.monto}
                  currency={oferta.total?.moneda || oferta.moneda}
                  size="xl"
                  className="text-airline-navy font-black"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Guaranteed Protection Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center gap-3 text-[11px] text-slate-500">
          <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Tus datos viajan cifrados. Los pagos de este sitio son simulados.</span>
        </div>
      </div>
    </aside>
  );
};
