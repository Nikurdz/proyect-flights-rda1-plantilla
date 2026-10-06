import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Luggage, Plane, User, Ticket, Printer } from 'lucide-react';
import { recuperarOrden } from '../../api/endpoints/orders';
import type { OrdenViewDto } from '../../api/types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { timeZoneOf } from '../../lib/airports';
import { fareFamilyLabel, formatDateTime, orderStatusLabel, orderStatusTone, passengerTypeLabel } from '../../lib/labels';
import { saveLastOrder } from '../../lib/storage';

export const RetrieveOrderPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [apellido, setApellido] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orden, setOrden] = useState<OrdenViewDto | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    document.title = 'Gestionar viaje | RAM Alliance';
  }, []);

  const handleRetrieve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !apellido) return;

    setIsLoading(true);
    setError(null);
    setOrden(null);

    const isOrderNumber = identifier.trim().toUpperCase().startsWith('ORD-');

    try {
      const data = await recuperarOrden({
        numero: isOrderNumber ? identifier.trim().toUpperCase() : undefined,
        pnr: !isOrderNumber ? identifier.trim().toUpperCase() : undefined,
        apellido: apellido.trim(),
      });
      setOrden(data);
      saveLastOrder(data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-airline-sand px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-gold-light text-brand-gold-dark flex items-center justify-center mx-auto mb-3">
            <Luggage className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-brand-black">
            Gestiona tu viaje
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
            Ingresa tu código de reserva (6 caracteres) o tu número de orden, junto con el apellido de uno de los pasajeros.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80 mb-8">
          <form onSubmit={handleRetrieve} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Código de reserva o número de orden"
                placeholder="Ej. ABC123 o ORD-7K3M9PQ2XA"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
              <Input
                label="Apellido del pasajero"
                placeholder="Ej. Pérez"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full sm:w-auto px-8 gap-2"
            >
              <Search className="w-4 h-4" />
              <span>Buscar reserva</span>
            </Button>
          </form>
        </div>

        {error != null && <ProblemAlert error={error} className="mb-6" />}

        {/* Order Details View */}
        {orden && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80 space-y-6 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Código de reserva
                </span>
                <span className="text-2xl font-black text-brand-black font-mono tracking-wider">
                  {orden.pnr || 'No asignado'}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Orden: {orden.numeroOrden}
                </span>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold ${orderStatusTone(orden.estado)}`}>
                {orderStatusLabel(orden.estado)}
              </span>
            </div>

            {/* Itinerary */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Itinerario
              </h4>
              <div className="space-y-3">
                {orden.itinerarios?.map((itin, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-brand-black text-white">
                        <Plane className="w-4 h-4 -rotate-45" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {itin.origen} → {itin.destino} ({itin.numeroVuelo})
                        </div>
                        <div className="text-xs text-slate-500">
                          Operado por {(itin.operador as { nombre?: string })?.nombre} · Tarifa <strong>{fareFamilyLabel(itin.familia)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs sm:text-right text-slate-600">
                      <div>Salida: {formatDateTime(itin.salida, timeZoneOf(itin.origen))}</div>
                      <div>Llegada: {formatDateTime(itin.llegada, timeZoneOf(itin.destino))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Passengers & e-Tickets */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Pasajeros y billetes electrónicos
              </h4>
              <div className="space-y-2">
                {orden.pasajeros?.map((pax) => (
                  <div key={pax.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-bold text-slate-900">
                        {pax.nombres} {pax.apellidos}
                      </span>
                      <span className="text-slate-400">({passengerTypeLabel(pax.tipo)})</span>
                    </div>

                    {pax.eTicket && (
                      <div className="flex items-center gap-1.5 font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                        <Ticket className="w-3.5 h-3.5 text-brand-gold-dark" />
                        <span>Billete: {pax.eTicket}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Total & Action */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-500 block">Total pagado</span>
                <div className="text-brand-black font-black text-xl">
                  <MoneyText amount={orden.total?.monto} currency={orden.total?.moneda} size="xl" />
                </div>
              </div>

              <Link
                to={`/confirmacion/${orden.numeroOrden}`}
                state={{ orden }}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-black text-white text-xs font-bold hover:bg-brand-navy transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4 text-brand-gold" />
                <span>Ver e imprimir comprobante</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
