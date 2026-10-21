import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Calendar, Search } from 'lucide-react';
import { AirportPicker } from './AirportPicker';
import { PassengerSelector, type PassengerCounts } from './PassengerSelector';
import { getValidSearchDateString, getTomorrowDateString, addDaysToDate } from '../../lib/dates';
import { Button } from '../../components/ui/Button';

export interface SearchBarProps {
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const minValidDate = getValidSearchDateString();
  const defaultDeparture = getTomorrowDateString();

  // Initialize state from URL params or defaults
  const [tripType, setTripType] = useState<'RT' | 'OW'>(
    (searchParams.get('trip') as 'RT' | 'OW') || (searchParams.get('inbound') ? 'RT' : 'RT')
  );
  const [origin, setOrigin] = useState<string>(searchParams.get('origin') || '');
  const [destination, setDestination] = useState<string>(searchParams.get('destination') || '');
  const [outbound, setOutbound] = useState<string>(
    searchParams.get('outbound') || defaultDeparture
  );
  const [inbound, setInbound] = useState<string>(
    searchParams.get('inbound') || addDaysToDate(defaultDeparture, 7)
  );
  const [passengers, setPassengers] = useState<PassengerCounts>({
    adt: Number(searchParams.get('adt')) || 1,
    chd: Number(searchParams.get('chd')) || 0,
    inf: Number(searchParams.get('inf')) || 0,
  });

  const [originError, setOriginError] = useState<string>('');
  const [destinationError, setDestinationError] = useState<string>('');
  const [dateError, setDateError] = useState<string>('');

  const today = minValidDate;

  // Swap Origin and Destination
  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
    setOriginError('');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    // A round trip needs both airports to be priced; a one-way search may explore from or to anywhere.
    let invalid = false;
    setOriginError('');
    setDestinationError('');
    setDateError('');
    if (tripType === 'RT' && !origin) {
      setOriginError('Elige el origen.');
      invalid = true;
    }
    if (tripType === 'RT' && !destination) {
      setDestinationError('Elige el destino.');
      invalid = true;
    }
    if (origin && destination && origin === destination) {
      setDestinationError('El destino debe ser distinto del origen.');
      invalid = true;
    }
    if (!outbound || outbound < minValidDate) {
      setDateError('Elige una fecha de ida desde hoy.');
      invalid = true;
    } else if (tripType === 'RT' && (!inbound || inbound < outbound)) {
      setDateError('La vuelta no puede ser antes de la ida.');
      invalid = true;
    }
    if (invalid) {
      // Move the focus to the first invalid field once React has rendered the errors.
      const form = e.currentTarget;
      window.setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    const params = new URLSearchParams();
    if (origin) params.set('origin', origin);
    if (destination) params.set('destination', destination);
    if (outbound) params.set('outbound', outbound);
    if (tripType === 'RT' && inbound) params.set('inbound', inbound);
    params.set('trip', tripType);
    params.set('adt', String(passengers.adt));
    if (passengers.chd > 0) params.set('chd', String(passengers.chd));
    if (passengers.inf > 0) params.set('inf', String(passengers.inf));
    params.set('cabin', 'ECONOMY');
    params.set('sort', searchParams.get('sort') || 'RECOMENDADO');

    navigate(`/resultados?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSearch}
      noValidate
      aria-label="Buscar vuelos"
      className={`bg-white rounded-3xl shadow-elevated border border-slate-200/90 p-5 sm:p-7 ${className}`}
    >
      {/* Top Options: Trip Type & Cabin */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTripType('RT')}
            aria-pressed={tripType === 'RT'}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              tripType === 'RT'
                ? 'bg-brand-black text-white border border-brand-gold/50 shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Ida y vuelta
          </button>
          <button
            type="button"
            onClick={() => setTripType('OW')}
            aria-pressed={tripType === 'OW'}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              tripType === 'OW'
                ? 'bg-brand-black text-white border border-brand-gold/50 shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Solo ida
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            Cabina Economy
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Solo vuelos directos
          </span>
        </div>
      </div>

      {/* Main Grid: Origin, Swap, Destination, Dates, Passengers */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        {/* Origin (3 cols) */}
        <div className="md:col-span-3">
          <AirportPicker
            label="Origen"
            placeholder="Ciudad de salida (ej. BOG, MIA)..."
            type="origin"
            value={origin}
            error={originError}
            onChange={(val) => {
              setOrigin(val);
              setOriginError('');
              setDestinationError('');
            }}
          />
        </div>

        {/* Swap Button (1 col) */}
        <div className="md:col-span-1 flex justify-center pb-2">
          <button
            type="button"
            onClick={handleSwap}
            className="w-10 h-10 rounded-full border border-slate-200 hover:border-brand-gold hover:text-brand-gold text-slate-500 bg-slate-50 hover:bg-brand-gold/10 flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            aria-label="Invertir origen y destino"
            title="Invertir origen y destino"
          >
            <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Destination (3 cols) */}
        <div className="md:col-span-3">
          <AirportPicker
            label="Destino"
            placeholder="Destino (ej. MAD, SCL, MEX)..."
            type="destination"
            value={destination}
            error={destinationError}
            onChange={(val) => {
              setDestination(val);
              setDestinationError('');
            }}
          />
        </div>

        {/* Dates (3 cols) */}
        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Outbound Date */}
          <div className="min-w-0">
            <label htmlFor="search-outbound" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Ida
            </label>
            <div className="relative">
              <input
                id="search-outbound"
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? 'search-date-error' : undefined}
                type="date"
                min={today}
                value={outbound}
                onChange={(e) => {
                  setOutbound(e.target.value);
                  if (inbound && e.target.value > inbound) {
                    setInbound(e.target.value);
                  }
                }}
                className="w-full min-w-0 h-[54px] px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-800 bg-white focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" aria-hidden="true" />
            </div>
          </div>

          {/* Inbound Date */}
          <div className="min-w-0">
            <label htmlFor="search-inbound" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Vuelta
            </label>
            <div className="relative">
              <input
                id="search-inbound"
                aria-invalid={Boolean(dateError) && tripType === 'RT'}
                aria-describedby={dateError ? 'search-date-error' : undefined}
                type="date"
                min={outbound || today}
                disabled={tripType === 'OW'}
                value={tripType === 'OW' ? '' : inbound}
                onChange={(e) => setInbound(e.target.value)}
                className={`w-full min-w-0 h-[54px] px-3 rounded-xl border text-xs sm:text-sm font-semibold text-slate-800 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 ${
                  tripType === 'OW'
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-slate-300'
                }`}
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" aria-hidden="true" />
            </div>
          </div>
        </div>

        {dateError && (
          <p id="search-date-error" className="md:col-span-12 text-xs font-medium text-red-600" role="alert">
            {dateError}
          </p>
        )}

        {/* Passengers (2 cols) */}
        <div className="md:col-span-2">
          <PassengerSelector
            counts={passengers}
            onChange={(next) => setPassengers(next)}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-500 text-center sm:text-left">
          Elige tus aeropuertos y fechas. Todos los precios en dólares (USD).
        </p>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full sm:w-auto px-8 gap-2 bg-[#0B0E14] hover:bg-[#1E293B] border border-[#C5A880]/50 text-white hover:text-[#C5A880] shadow-md hover:shadow-lg font-black transition-all"
        >
          <Search className="w-4 h-4 text-[#C5A880]" aria-hidden="true" />
          <span>Buscar vuelos</span>
        </Button>
      </div>
    </form>
  );
};
