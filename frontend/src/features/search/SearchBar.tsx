import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeftRight, Search } from 'lucide-react';
import { AirportPicker } from './AirportPicker';
import { PassengerSelector, type PassengerCounts } from './PassengerSelector';
import { getValidSearchDateString, getTomorrowDateString, addDaysToDate } from '../../lib/dates';
import { Button } from '../../components/ui/Button';

export interface SearchBarProps {
  className?: string;
  /** Airports to start with when the address carries none (the route shortcuts of the home page). */
  defaults?: { origin?: string; destination?: string };
  /** Puts the focus on «Buscar vuelos» when the form appears (after choosing a shortcut). */
  focusSubmit?: boolean;
}

const dateInput =
  'h-12 w-full min-w-0 rounded-lg border bg-surface px-3 text-body text-ink focus-visible:border-gold-text disabled:cursor-not-allowed disabled:bg-ink/5 disabled:text-muted';

export const SearchBar: React.FC<SearchBarProps> = ({ className = '', defaults, focusSubmit = false }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const minValidDate = getValidSearchDateString();
  const defaultDeparture = getTomorrowDateString();

  // Initialize state from URL params or defaults
  const [tripType, setTripType] = useState<'RT' | 'OW'>(
    (searchParams.get('trip') as 'RT' | 'OW') || (searchParams.get('inbound') ? 'RT' : 'RT')
  );
  const [origin, setOrigin] = useState<string>(searchParams.get('origin') || defaults?.origin || '');
  const [destination, setDestination] = useState<string>(searchParams.get('destination') || defaults?.destination || '');
  const [outbound, setOutbound] = useState<string>(
    searchParams.get('outbound') || defaultDeparture
  );
  const [inbound, setInbound] = useState<string>(
    searchParams.get('inbound') || addDaysToDate(defaultDeparture, 7)
  );
  const [passengers, setPassengers] = useState<PassengerCounts>({
    adt: Number(searchParams.get('adt')) || 1,
    yth: Number(searchParams.get('yth')) || 0,
    chd: Number(searchParams.get('chd')) || 0,
    inf: Number(searchParams.get('inf')) || 0,
  });

  const [originError, setOriginError] = useState<string>('');
  const [destinationError, setDestinationError] = useState<string>('');
  const [dateError, setDateError] = useState<string>('');

  const today = minValidDate;
  const submitRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusSubmit) submitRef.current?.focus();
  }, [focusSubmit]);

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
      setOriginError('Elige desde dónde sales.');
      invalid = true;
    }
    if (tripType === 'RT' && !destination) {
      setDestinationError('Elige a dónde viajas.');
      invalid = true;
    }
    if (origin && destination && origin === destination) {
      setDestinationError('El destino debe ser distinto de la ciudad de salida.');
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
    if (passengers.yth > 0) params.set('yth', String(passengers.yth));
    if (passengers.chd > 0) params.set('chd', String(passengers.chd));
    if (passengers.inf > 0) params.set('inf', String(passengers.inf));
    params.set('cabin', 'ECONOMY');
    params.set('sort', searchParams.get('sort') || 'RECOMENDADO');

    navigate(`/resultados?${params.toString()}`);
  };

  const roundTrip = tripType === 'RT';
  const tripOption = (value: 'RT' | 'OW', label: string) => (
    <button
      type="button"
      onClick={() => setTripType(value)}
      aria-pressed={tripType === value}
      className={`min-h-[44px] rounded-full px-4 text-small font-medium transition-colors sm:min-h-[36px] ${
        tripType === value ? 'bg-ink text-on-ink' : 'bg-ink/[0.07] text-ink hover:bg-ink/[0.12]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <form
      onSubmit={handleSearch}
      noValidate
      aria-label="Buscar vuelos"
      className={`rounded-xl border border-line bg-surface p-5 shadow-elevated sm:p-6 ${className}`}
    >
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Tipo de viaje">
        {tripOption('RT', 'Ida y vuelta')}
        {tripOption('OW', 'Solo ida')}
      </div>

      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <AirportPicker
            label="Origen"
            placeholder="Quito, Guayaquil…"
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

        <div className="flex justify-center md:col-span-1 md:pb-1">
          <button
            type="button"
            onClick={handleSwap}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-muted transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Invertir origen y destino"
            title="Invertir origen y destino"
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="md:col-span-4">
          <AirportPicker
            label="Destino"
            placeholder="Loja, Galápagos, Bogotá…"
            type="destination"
            value={destination}
            error={destinationError}
            onChange={(val) => {
              setDestination(val);
              setDestinationError('');
            }}
          />
        </div>

        <div className="md:col-span-3">
          <PassengerSelector counts={passengers} onChange={(next) => setPassengers(next)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-6">
          <div className="min-w-0">
            <label htmlFor="search-outbound" className="mb-1.5 block text-sm font-medium text-ink">
              Ida
            </label>
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
              className={`${dateInput} ${dateError ? 'border-danger' : 'border-line-strong hover:border-ink/50'}`}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="search-inbound" className="mb-1.5 block text-sm font-medium text-ink">
              Vuelta
            </label>
            <input
              id="search-inbound"
              aria-invalid={Boolean(dateError) && roundTrip}
              aria-describedby={dateError ? 'search-date-error' : undefined}
              type="date"
              min={outbound || today}
              disabled={!roundTrip}
              value={roundTrip ? inbound : ''}
              onChange={(e) => setInbound(e.target.value)}
              className={`${dateInput} ${dateError && roundTrip ? 'border-danger' : 'border-line-strong hover:border-ink/50'}`}
            />
          </div>
        </div>

        <div className="md:col-span-6">
          <Button ref={submitRef} type="submit" variant="accent" size="lg" className="w-full gap-2">
            <Search className="h-5 w-5" aria-hidden="true" />
            <span>Buscar vuelos</span>
          </Button>
        </div>

        {dateError && (
          <p id="search-date-error" className="flex items-start gap-1.5 text-sm font-medium text-danger md:col-span-12" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {dateError}
          </p>
        )}
      </div>

      <p className="mt-4 text-small text-muted">
        Todos los vuelos son directos y en clase económica. Los precios incluyen impuestos y están en dólares (USD).
      </p>
    </form>
  );
};
