import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plane, ArrowLeft, CheckCircle2 } from 'lucide-react';
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
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Skeleton } from '../../components/ui/Skeleton';
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
    chd,
    inf,
    sort,
  };

  const { data: disponibilidad, isLoading, error, refetch } = useDisponibilidad(queryCriteria);

  // Round Trip multi-leg selection state
  const [activeLegIndex, setActiveLegIndex] = useState<number>(0);
  const [selectedOutbound, setSelectedOutbound] = useState<{
    itinerario: ItinerarioDto;
    familia: FamiliaTarifariaDto;
  } | null>(null);

  // The outbound flight picked is only valid for the route, outbound day and party it was picked for. The return
  // date is not part of the key: changing it must keep the outbound choice and stay on the return leg.
  const outboundKey = outboundSelectionKey({ origin, destination, outbound, trip, adt, chd, inf });
  useEffect(() => {
    setSelectedOutbound(null);
    setActiveLegIndex(0);
  }, [outboundKey]);

  // Any change of the search (the return day included) clears an old error from a previous attempt.
  const searchKey = `${outboundKey}|${inbound}`;
  useEffect(() => {
    setOfferError(null);
  }, [searchKey]);

  // Fare modal state
  const [modalItinerario, setModalItinerario] = useState<ItinerarioDto | null>(null);
  const [isFareModalOpen, setIsFareModalOpen] = useState(false);

  // Loading checkout creation
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [offerError, setOfferError] = useState<unknown>(null);

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
            jovenes: 0,
            ninos: chd,
            infantes: inf,
          },
        },
        idempotencyKey
      );

      // Navigate to Checkout with offerId
      navigate(`/checkout/${oferta.ofertaId}`);
    } catch (err) {
      setOfferError(err);
      setIsCreatingOffer(false);
    }
  };

  const trayectos = disponibilidad?.trayectos || [];
  const currentTrayecto = trayectos[activeLegIndex] || trayectos[0];

  // Only the leg on screen counts: the API flags the whole search when ANY leg is empty, which
  // would hide the outbound flights that do exist when only the return day has none.
  const hasNoFlights = Boolean(currentTrayecto) && currentTrayecto.itinerarios.length === 0;

  const minValidDate = getValidSearchDateString();
  const activeDate =
    activeLegIndex === 0
      ? outbound || currentTrayecto?.fecha || minValidDate
      : inbound || currentTrayecto?.fecha || addDaysToDate(outbound || minValidDate, 7);

  const minLegDate = activeLegIndex === 0 ? minValidDate : outbound || minValidDate;
  const lowestPrice = currentTrayecto?.itinerarios?.[0]?.precioDesde;

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

  return (
    <div className="bg-airline-sand px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Navigation Breadcrumb & Back */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(`/?${searchParams.toString()}`)}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-airline-navy transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Modificar búsqueda</span>
          </button>

          <span className="rounded-full border border-brand-gold/40 bg-brand-gold-light px-3 py-1 text-xs font-semibold text-brand-gold-dark">
            Precios en dólares (USD)
          </span>
        </div>

        {/* Round Trip Stepper Tabs */}
        {trip === 'RT' && trayectos.length > 1 && (
          <div className="flex rounded-2xl bg-white p-2 shadow-sm border border-slate-200/80 mb-6">
            <button
              onClick={() => setActiveLegIndex(0)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeLegIndex === 0
                  ? 'bg-airline-navy text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Plane className="w-4 h-4 -rotate-45" />
              <span>1. Vuelo de Ida</span>
              {selectedOutbound && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-1" />
              )}
            </button>

            <button
              onClick={() => {
                if (selectedOutbound) setActiveLegIndex(1);
              }}
              disabled={!selectedOutbound}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeLegIndex === 1
                  ? 'bg-airline-navy text-white shadow-sm'
                  : selectedOutbound
                  ? 'text-slate-600 hover:bg-slate-50'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
            >
              <Plane className="w-4 h-4 rotate-[135deg]" />
              <span>2. Vuelo de Vuelta</span>
            </button>
          </div>
        )}

        {/* Selected Outbound Summary if picking return */}
        {activeLegIndex === 1 && selectedOutbound && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold text-emerald-950">Vuelo de Ida seleccionado: </span>
                <span className="text-emerald-800">
                  {selectedOutbound.itinerario.origen.ciudad} a{' '}
                  {selectedOutbound.itinerario.destino.ciudad} ({selectedOutbound.itinerario.numeroVuelo}) · Tarifa{' '}
                  <strong className="uppercase">{selectedOutbound.familia.codigo}</strong>
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveLegIndex(0)}
              className="text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
            >
              Cambiar ida
            </button>
          </div>
        )}

        {/* Global Date Navigator Always Available */}
        <DateNavigator
          currentDate={activeDate}
          minDate={minLegDate}
          lowestPrice={lowestPrice}
          fechasAlternativas={currentTrayecto?.fechasAlternativas}
          onSelectDate={handleNavigateDate}
          label={
            trip === 'RT'
              ? activeLegIndex === 0
                ? 'Navegador de Fechas · Vuelo de Ida:'
                : 'Navegador de Fechas · Vuelo de Vuelta:'
              : 'Navegador de Fechas para este trayecto:'
          }
        />

        {/* Global Errors */}
        {error != null && (
          <div className="mb-6">
            <ProblemAlert error={error} onRetry={() => refetch()} />
          </div>
        )}
        {offerError != null && (
          <div className="mb-6">
            <ProblemAlert error={offerError} />
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading || isCreatingOffer ? (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-8 w-32" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex justify-between items-center gap-6">
                  <Skeleton className="h-12 w-48" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-12 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : hasNoFlights ? (
          <EmptyState
            originLabel={currentTrayecto?.origen ?? origin}
            destinationLabel={currentTrayecto?.destino ?? destination}
            date={activeDate}
            alternatives={currentTrayecto?.fechasAlternativas}
            canGoPrevious={addDaysToDate(activeDate, -1) >= minLegDate}
            onPreviousDay={() => handleNavigateDate(addDaysToDate(activeDate, -1))}
            onNextDay={() => handleNavigateDate(addDaysToDate(activeDate, 1))}
            onPickDate={handleNavigateDate}
            onModifySearch={() => navigate(`/?${searchParams.toString()}`)}
          />
        ) : (
          <div>
            {/* Sorting bar */}
            <SortingBar
              currentSort={sort}
              onSortChange={handleSortChange}
              totalResults={currentTrayecto?.itinerarios.length || 0}
            />

            {/* List of Flights */}
            <div className="space-y-4">
              {currentTrayecto?.itinerarios.map((itinerario) => (
                <FlightCard
                  key={itinerario.itinerarioId}
                  itinerario={itinerario}
                  onSelect={handleSelectFlight}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fare Families Modal */}
      <FareComparisonModal
        isOpen={isFareModalOpen}
        onClose={() => setIsFareModalOpen(false)}
        itinerario={modalItinerario}
        passengers={{ adt, chd, inf }}
        onSelectFare={handleSelectFare}
      />
    </div>
  );
};
