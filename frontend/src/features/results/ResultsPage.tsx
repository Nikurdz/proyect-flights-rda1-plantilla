import React, { useState } from 'react';
import { useKeyedState } from '../../hooks/useKeyedState';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plane, CheckCircle2, AlertTriangle, CalendarSearch } from 'lucide-react';
import { useDisponibilidad } from '../../api/endpoints/catalog';
import { armarOferta } from '../../api/endpoints/offers';
import { crearSesionInvitado } from '../../api/endpoints/auth';
import { getSession } from '../../lib/session';
import { MERCADO } from '../../lib/market';
import { generateUUID } from '../../lib/uuid';
import type {
  FamiliaTarifariaDto,
  ItinerarioDto,
  Ordenamiento,
  SearchParams,
  SeleccionTrayectoDto,
} from '../../api/types';

import { FlightCard } from './FlightCard';
import { SortingBar } from './SortingBar';
import { DateNavigator } from './DateNavigator';
import { EmptyState } from './EmptyState';
import { FareComparisonModal } from '../fares/FareComparisonModal';
import { ProblemDetailsError } from '../../api/problem-details';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { lowestTotalIndex, onlyFlaggedIndex, uniqueMinIndex } from '../../lib/best-value';
import { describePassengers } from '../../lib/search';
import { formatDay } from '../../lib/labels';
import { getValidSearchDateString, addDaysToDate } from '../../lib/dates';
import { outboundSelectionKey } from '../../lib/search';

export const ResultsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract query parameters
  const origin = searchParams.get('origin') || undefined;
  const destination = searchParams.get('destination') || undefined;
  const outbound = searchParams.get('outbound') || undefined;
  const inbound = searchParams.get('inbound') || undefined;
  const trip = (searchParams.get('trip') as 'RT' | 'OW') || (inbound ? 'RT' : 'OW');
  const adt = Number(searchParams.get('adt')) || 1;
  const yth = Number(searchParams.get('yth')) || 0;
  const chd = Number(searchParams.get('chd')) || 0;
  const inf = Number(searchParams.get('inf')) || 0;
  const sort = (searchParams.get('sort') as Ordenamiento) || 'RECOMENDADO';

  const queryCriteria: SearchParams = {
    origin,
    destination,
    outbound,
    inbound: trip === 'RT' ? inbound : undefined,
    trip,
    adt,
    yth,
    chd,
    inf,
    sort,
  };

  const { data: disponibilidad, isLoading, error, refetch } = useDisponibilidad(queryCriteria);

  // Round Trip multi-leg selection state.
  // The outbound flight picked is only valid for the route, outbound day and party it was picked for. The return
  // date is not part of the key: changing it must keep the outbound choice and stay on the return leg.
  const outboundKey = outboundSelectionKey({ origin, destination, outbound, trip, adt, yth, chd, inf });
  const [activeLegIndex, setActiveLegIndex] = useKeyedState<number>(outboundKey, 0);
  const [selectedOutbound, setSelectedOutbound] = useKeyedState<{
    itinerario: ItinerarioDto;
    familia: FamiliaTarifariaDto;
  } | null>(outboundKey, null);

  // Any change of the search (the return day included) clears an old error from a previous attempt.
  const searchKey = `${outboundKey}|${inbound}`;

  // Fare modal state
  const [modalItinerario, setModalItinerario] = useState<ItinerarioDto | null>(null);
  const [isFareModalOpen, setIsFareModalOpen] = useState(false);

  // Loading checkout creation
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [offerError, setOfferError] = useKeyedState<unknown>(searchKey, null);
  const [soldOutNotice, setSoldOutNotice] = useKeyedState<boolean>(searchKey, false);

  // Handle Sort Change
  const handleSortChange = (newSort: Ordenamiento) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('sort', newSort);
    setSearchParams(nextParams);
  };

  // Handle Flight Click -> Opens Fare Family Comparator
  const handleSelectFlight = (itinerario: ItinerarioDto) => {
    setModalItinerario(itinerario);
    setIsFareModalOpen(true);
  };

  // Handle Fare Selection
  const handleSelectFare = async (itinerario: ItinerarioDto, familia: FamiliaTarifariaDto) => {
    setIsFareModalOpen(false);

    const isRoundTrip = trip === 'RT' && disponibilidad?.trayectos && disponibilidad.trayectos.length > 1;

    if (isRoundTrip && activeLegIndex === 0) {
      // Save Outbound and advance to Inbound leg
      setSelectedOutbound({ itinerario, familia });
      setActiveLegIndex(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // We have all segments! Proceed to create offer in Checkout
      await finalizeOfferSelection([
        ...(selectedOutbound
          ? [
              {
                itinerarioId: selectedOutbound.itinerario.itinerarioId,
                familia: selectedOutbound.familia.codigo,
              },
            ]
          : []),
        {
          itinerarioId: itinerario.itinerarioId,
          familia: familia.codigo,
        },
      ]);
    }
  };

  // Finalize Offer & Navigate to Checkout
  const finalizeOfferSelection = async (selecciones: SeleccionTrayectoDto[]) => {
    setIsCreatingOffer(true);
    setOfferError(null);

    try {
      // Buying needs a session: a customer's, or a guest's when there is none (or it expired).
      if (!getSession()) {
        await crearSesionInvitado();
      }

      // Generate Idempotency-Key
      const idempotencyKey = generateUUID();

      const oferta = await armarOferta(
        {
          mercado: MERCADO,
          selecciones,
          pasajeros: {
            adultos: adt,
            jovenes: yth,
            ninos: chd,
            infantes: inf,
          },
        },
        idempotencyKey
      );

      // Navigate to Checkout with offerId
      navigate(`/checkout/${oferta.ofertaId}`);
    } catch (err) {
      if (err instanceof ProblemDetailsError && err.status === 409 && err.code === 'SEAT_TAKEN') {
        // Someone else took the last seat while the list was on screen: back to a fresh list.
        setSoldOutNotice(true);
        setSelectedOutbound(null);
        setActiveLegIndex(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        void refetch();
      } else {
        setOfferError(err);
      }
      setIsCreatingOffer(false);
    }
  };

  const trayectos = disponibilidad?.trayectos || [];
  const currentTrayecto = trayectos[activeLegIndex] || trayectos[0];

  // Only the leg on screen counts: the API flags the whole search when ANY leg is empty, which
  // would hide the outbound flights that do exist when only the return day has none.
  // Sold-out flights (agotado) come last and are shown, but they are not bookable: they count as "no flights".
  const bookableFlights = (currentTrayecto?.itinerarios ?? []).filter((i) => !i.agotado);
  const hasNoFlights = Boolean(currentTrayecto) && bookableFlights.length === 0 && (currentTrayecto?.itinerarios.length ?? 0) === 0;
  const allSoldOut =
    Boolean(currentTrayecto) && bookableFlights.length === 0 && (currentTrayecto?.itinerarios.length ?? 0) > 0;
  const seatsNeeded = adt + yth + chd;
  // Más conveniente: the bookable flight with the lowest price (same group for all, so also the lowest total).
  const bestIndex = lowestTotalIndex(bookableFlights.map((i) => i.precioDesde?.monto));
  const bestFlightId = bestIndex >= 0 ? bookableFlights[bestIndex].itinerarioId : null;
  // «Más rápido» only for a single strictly fastest flight; «Recomendado» only when exactly one is flagged.
  const fastestIndex = uniqueMinIndex(bookableFlights.map((i) => i.duracionMinutos));
  const fastestFlightId = fastestIndex >= 0 ? bookableFlights[fastestIndex].itinerarioId : null;
  const recommendedIndex = onlyFlaggedIndex(bookableFlights.map((i) => Boolean(i.distintivos?.includes('RECOMENDADO'))));
  const recommendedFlightId = recommendedIndex >= 0 ? bookableFlights[recommendedIndex].itinerarioId : null;

  const minValidDate = getValidSearchDateString();
  const activeDate =
    activeLegIndex === 0
      ? outbound || currentTrayecto?.fecha || minValidDate
      : inbound || currentTrayecto?.fecha || addDaysToDate(outbound || minValidDate, 7);

  const minLegDate = activeLegIndex === 0 ? minValidDate : outbound || minValidDate;
  const lowestPrice = bookableFlights[0]?.precioDesde;

  const handleNavigateDate = (newDate: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (activeLegIndex === 0) {
      nextParams.set('outbound', newDate);
      const currentInbound = nextParams.get('inbound');
      if (trip === 'RT' && currentInbound && currentInbound < newDate) {
        nextParams.set('inbound', addDaysToDate(newDate, 7));
      }
    } else {
      nextParams.set('inbound', newDate);
    }
    setSearchParams(nextParams);
  };

  const firstFlight = currentTrayecto?.itinerarios[0];
  const routeTitle = `${firstFlight?.origen.ciudad ?? currentTrayecto?.origen ?? origin ?? 'Tu origen'} a ${
    firstFlight?.destino.ciudad ?? currentTrayecto?.destino ?? destination ?? 'tu destino'
  }`;
  const legName = trip === 'RT' && activeLegIndex === 1 ? 'Vuelo de vuelta' : 'Vuelo de ida';
  const modifySearch = () => navigate(`/?${searchParams.toString()}`);

  const tabClass = (active: boolean, enabled: boolean) =>
    `flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-small font-medium transition-colors ${
      active ? 'bg-ink text-on-ink' : enabled ? 'text-ink hover:bg-ink/5' : 'cursor-not-allowed text-muted opacity-60'
    }`;

  return (
    <div className="bg-paper px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title={routeTitle}
          description={`${legName} · ${formatDay(`${activeDate}T12:00:00Z`)} · ${describePassengers({ adt, yth, chd, inf })}. Precios en dólares (USD).`}
          actions={
            <Button type="button" variant="outline" onClick={modifySearch} className="gap-2">
              <CalendarSearch className="h-4 w-4" aria-hidden="true" />
              Modificar búsqueda
            </Button>
          }
        />

        {trip === 'RT' && trayectos.length > 1 && (
          <div className="mb-6 flex gap-1 rounded-xl border border-line bg-surface p-1.5" role="group" aria-label="Tramo del viaje">
            <button type="button" onClick={() => setActiveLegIndex(0)} aria-pressed={activeLegIndex === 0} className={tabClass(activeLegIndex === 0, true)}>
              <Plane className="h-4 w-4 -rotate-45" aria-hidden="true" />
              <span>1. Vuelo de ida</span>
              {selectedOutbound && <CheckCircle2 className="h-4 w-4 text-success" aria-label="Elegido" />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedOutbound) setActiveLegIndex(1);
              }}
              disabled={!selectedOutbound}
              aria-pressed={activeLegIndex === 1}
              className={tabClass(activeLegIndex === 1, Boolean(selectedOutbound))}
            >
              <Plane className="h-4 w-4 rotate-[135deg]" aria-hidden="true" />
              <span>2. Vuelo de vuelta</span>
            </button>
          </div>
        )}

        {activeLegIndex === 1 && selectedOutbound && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-success/30 bg-success-soft p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <p className="text-small text-ink">
                <span className="font-semibold">Vuelo de ida elegido: </span>
                {selectedOutbound.itinerario.origen.ciudad} a {selectedOutbound.itinerario.destino.ciudad} ({selectedOutbound.itinerario.numeroVuelo}), tarifa{' '}
                {selectedOutbound.familia.nombre || selectedOutbound.familia.codigo}
              </p>
            </div>
            <button type="button" onClick={() => setActiveLegIndex(0)} className="min-h-[44px] shrink-0 px-2 text-small font-semibold text-ink underline underline-offset-2">
              Cambiar ida
            </button>
          </div>
        )}

        <DateNavigator
          currentDate={activeDate}
          minDate={minLegDate}
          lowestPrice={lowestPrice}
          fechasAlternativas={currentTrayecto?.fechasAlternativas}
          onSelectDate={handleNavigateDate}
          label={trip === 'RT' ? (activeLegIndex === 0 ? 'Cambia el día del vuelo de ida' : 'Cambia el día del vuelo de vuelta') : 'Cambia el día de tu vuelo'}
        />

        {error != null && (
          <div className="mb-6">
            <ProblemAlert error={error} onRetry={() => refetch()} />
          </div>
        )}
        {soldOutNotice && (
          <div role="alert" className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-small text-ink">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Ese vuelo se quedó sin asientos.</strong> Elige otro vuelo o cambia las fechas.
              </span>
            </p>
            <button type="button" onClick={() => setSoldOutNotice(false)} className="min-h-[44px] shrink-0 px-2 font-semibold underline underline-offset-2">
              Cerrar
            </button>
          </div>
        )}
        {offerError != null && (
          <div className="mb-6">
            <ProblemAlert error={offerError} />
          </div>
        )}

        {isLoading || isCreatingOffer ? (
          <div className="space-y-4" role="status" aria-busy="true" aria-label={isCreatingOffer ? 'Preparando tu reserva' : 'Buscando vuelos'}>
            <p className="text-body font-medium text-ink">
              {isCreatingOffer ? 'Preparando tu reserva. Estamos apartando tus asientos.' : 'Buscando vuelos…'}
            </p>
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center justify-between gap-6">
                  <Skeleton className="h-12 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-12 w-24" />
                </div>
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : hasNoFlights || allSoldOut ? (
          <EmptyState
            originLabel={currentTrayecto?.origen ?? origin}
            destinationLabel={currentTrayecto?.destino ?? destination}
            date={activeDate}
            alternatives={currentTrayecto?.fechasAlternativas}
            canGoPrevious={addDaysToDate(activeDate, -1) >= minLegDate}
            onPreviousDay={() => handleNavigateDate(addDaysToDate(activeDate, -1))}
            onNextDay={() => handleNavigateDate(addDaysToDate(activeDate, 1))}
            onPickDate={handleNavigateDate}
            onModifySearch={modifySearch}
          />
        ) : (
          <div>
            <SortingBar currentSort={sort} onSortChange={handleSortChange} totalResults={bookableFlights.length} />

            <div className="space-y-4">
              {currentTrayecto?.itinerarios.map((itinerario) => (
                <FlightCard
                  key={itinerario.itinerarioId}
                  itinerario={itinerario}
                  passengerCount={seatsNeeded}
                  group={{ adt, yth, chd, inf }}
                  bestValue={itinerario.itinerarioId === bestFlightId}
                  fastest={itinerario.itinerarioId === fastestFlightId}
                  recommended={itinerario.itinerarioId === recommendedFlightId}
                  onSelect={handleSelectFlight}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <FareComparisonModal
        isOpen={isFareModalOpen}
        onClose={() => setIsFareModalOpen(false)}
        itinerario={modalItinerario}
        passengers={{ adt, yth, chd, inf }}
        onSelectFare={handleSelectFare}
      />
    </div>
  );
};
