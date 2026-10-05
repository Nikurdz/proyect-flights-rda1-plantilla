import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  assertChronology,
  assertGroupSize,
  assertInfantRatio,
  assertOriginDestinationDiffer,
} from '../../common/business-rules';
import { toIso, utcDayRange } from '../../common/date.util';
import { PASSENGER_TYPES, PassengerBreakdown, seatsRequired } from '../../common/pricing.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import { FareFamily } from '../../entities/fare-family.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { SearchService } from '../../services/search.service';
import { money } from '../common/moneda.util';
import { escapeLike, normalizarTexto } from '../common/texto.util';
import { Mercado } from '../mercados/entities/mercado.entity';
import { MercadosService } from '../mercados/mercados.service';
import {
  DisponibilidadQueryDto,
  DisponibilidadViewDto,
  FamiliaTarifariaDto,
  FechaAlternativaDto,
  ItinerarioDto,
  LocalidadViewDto,
  Ordenamiento,
  TarifasQueryDto,
  TarifasViewDto,
  TrayectoDisponibleDto,
} from './dto/catalogo.dto';
import { Localidad } from './entities/localidad.entity';
import { PreciosService } from './precios.service';

// RF-SHP-019: A-04 (the scarcity threshold) is an open business question; this is the default.
const SCARCITY_THRESHOLD = 9;
const ALTERNATIVE_DAYS = 3;
const SUGGESTION_LIMIT = 10;

interface ScoredFlight {
  vuelo: Vuelo;
  precio: number;
  familia: FareFamily;
}

/** D04 search and D05 fare comparison, over the same inventory the flight core sells from. */
@Injectable()
export class CatalogoService {
  constructor(
    @InjectRepository(Localidad) private readonly localidades: Repository<Localidad>,
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    @InjectRepository(FareFamily) private readonly familias: Repository<FareFamily>,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
    private readonly search: SearchService,
    private readonly mercados: MercadosService,
    private readonly precios: PreciosService,
  ) {}

  /** RF-SHP-002: prefix match on code, city and airport, ignoring accents and case. */
  async sugerirLocalidades(q: string): Promise<LocalidadViewDto[]> {
    const prefix = `${escapeLike(normalizarTexto(q))}%`;
    const rows = await this.localidades
      .createQueryBuilder('l')
      .where('LOWER(l.iata) LIKE :prefix OR l."ciudadNorm" LIKE :prefix OR l."nombreNorm" LIKE :prefix', { prefix })
      .orderBy('l.iata', 'ASC')
      .limit(SUGGESTION_LIMIT * 3)
      .getMany();

    const key = normalizarTexto(q);
    // An exact code first ("bog" -> BOG), then city matches, then airport-name matches.
    const rank = (l: Localidad) => (l.iata.toLowerCase() === key ? 0 : l.ciudadNorm.startsWith(key) ? 1 : 2);
    return rows
      .sort((a, b) => rank(a) - rank(b) || a.ciudad.localeCompare(b.ciudad))
      .slice(0, SUGGESTION_LIMIT)
      .map(({ iata, ciudad, nombre, pais, paisNombre, zonaHoraria }) => ({ iata, ciudad, nombre, pais, paisNombre, zonaHoraria }));
  }

  async buscarDisponibilidad(query: DisponibilidadQueryDto): Promise<DisponibilidadViewDto> {
    const mercado = await this.mercados.requerirActivo(query.mercado ?? 'ec');

    if ((query.cabin ?? 'ECONOMY') !== 'ECONOMY') {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Cabin not available', 'Only the ECONOMY cabin is sold in this phase.', [
        { name: 'cabin', reason: 'only ECONOMY is available' },
      ]);
    }
    const roundTrip = query.trip ? query.trip === 'RT' : query.inbound !== undefined;
    if (roundTrip && !query.inbound) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Return date required', 'A round trip needs the inbound date.', [{ name: 'inbound', reason: 'required for trip=RT' }]);
    }
    if (!roundTrip && query.inbound) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Unexpected return date', 'trip=OW is a one-way search; omit inbound.', [{ name: 'inbound', reason: 'not allowed for trip=OW' }]);
    }

    const legs = [{ origin: query.origin, destination: query.destination, departureDate: query.outbound, sentido: 'IDA' }];
    if (roundTrip) {
      legs.push({ origin: query.destination, destination: query.origin, departureDate: query.inbound!, sentido: 'VUELTA' });
    }

    const composicion = this.composicion(query);
    for (const leg of legs) assertOriginDestinationDiffer(leg);
    assertChronology(legs);
    assertInfantRatio(composicion);
    assertGroupSize(composicion, this.config.maxPassengersPerOrder);

    const familias = await this.search.requireFareFamilies();
    const seats = seatsRequired(composicion);

    const trayectos: TrayectoDisponibleDto[] = [];
    for (const leg of legs) {
      const flights = await this.search.findDirectFlights(leg.origin, leg.destination, leg.departureDate, seats);
      const itinerarios = await this.construirItinerarios(flights, familias, mercado, query.sort ?? 'RECOMENDADO');
      trayectos.push({
        sentido: leg.sentido,
        origen: leg.origin,
        destino: leg.destination,
        fecha: leg.departureDate,
        itinerarios,
        ...(itinerarios.length === 0
          ? { fechasAlternativas: await this.fechasAlternativas(leg.origin, leg.destination, leg.departureDate, seats, familias, mercado) }
          : {}),
      });
    }

    return {
      mercado: mercado.codigo,
      moneda: mercado.moneda,
      trayectos,
      sinDisponibilidad: trayectos.some((t) => t.itinerarios.length === 0),
    };
  }

  /** RF-PRC-002/003/009: every fare family of one itinerary, with structured conditions and a validity. */
  async tarifasDeItinerario(itinerarioId: string, query: TarifasQueryDto): Promise<TarifasViewDto> {
    const mercado = await this.mercados.requerirActivo(query.mercado ?? 'ec');
    const composicion: PassengerBreakdown = { adults: query.adt ?? 1, youths: 0, children: query.chd ?? 0, infants: query.inf ?? 0 };
    assertInfantRatio(composicion);
    assertGroupSize(composicion, this.config.maxPassengersPerOrder);

    const vuelo = await this.vuelos.findOne({ where: { id: itinerarioId } });
    if (!vuelo || new Date(vuelo.fechaSalida).getTime() <= Date.now()) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'OFFER_NO_LONGER_AVAILABLE', 'Itinerary not available', `Itinerary ${itinerarioId} does not exist or has already departed.`);
    }
    const familias = await this.search.requireFareFamilies();

    const resultado: FamiliaTarifariaDto[] = familias.map((familia) => {
      const cotizacion = this.precios.cotizar(vuelo, familia, composicion, mercado);
      return {
        codigo: familia.code,
        nombre: familia.name,
        cabina: 'ECONOMY',
        precioPorPasajero: PASSENGER_TYPES.filter((tipo) => cotizacion.unitarios[tipo]).map((tipo) => {
          const unit = cotizacion.unitarios[tipo]!;
          return { tipo, base: money(unit.baseMinor, mercado.moneda), tasas: money(unit.tasasMinor, mercado.moneda), total: money(unit.totalMinor, mercado.moneda) };
        }),
        totalGrupo: money(cotizacion.totalMinor, mercado.moneda),
        condiciones: {
          equipajeMano: { incluido: familia.carryOnKg > 0, kg: familia.carryOnKg },
          equipajeBodega: { piezas: familia.checkedBags },
          cambio: { permitido: familia.changeable },
          devolucion: { permitida: familia.refundable },
          seleccionAsiento: { incluida: familia.seatSelectionIncluded },
          upgrade: { elegible: familia.upgradeEligible },
          factorAcumulacion: familia.accrualFactor,
        },
        asientosDisponibles: vuelo.asientosDisponibles,
      };
    });

    return {
      itinerarioId,
      mercado: mercado.codigo,
      moneda: mercado.moneda,
      vigenteHasta: new Date(Date.now() + this.config.offerTtlMinutes * 60_000).toISOString(),
      familias: resultado,
    };
  }

  private composicion(query: { adt?: number; chd?: number; inf?: number }): PassengerBreakdown {
    return { adults: query.adt ?? 1, youths: 0, children: query.chd ?? 0, infants: query.inf ?? 0 };
  }

  private async construirItinerarios(flights: Vuelo[], familias: FareFamily[], mercado: Mercado, sort: Ordenamiento): Promise<ItinerarioDto[]> {
    if (flights.length === 0) return [];

    const codes = [...new Set(flights.flatMap((f) => [f.origenIATA, f.destinoIATA]))];
    const places = new Map((await this.localidades.find({ where: { iata: In(codes) } })).map((l) => [l.iata, l]));
    const place = (iata: string) => ({ iata, ciudad: places.get(iata)?.ciudad ?? iata, nombre: places.get(iata)?.nombre ?? iata });

    const scored: ScoredFlight[] = flights.map((vuelo) => {
      const desde = this.precios.precioDesde(vuelo, familias, mercado);
      return { vuelo, precio: desde.totalMinor, familia: desde.familia };
    });

    // RF-SHP-018: badges can coexist on one itinerary.
    const cheapest = Math.min(...scored.map((s) => s.precio));
    const fastest = Math.min(...scored.map((s) => s.vuelo.durationMinutes));
    const recommended = this.recomendado(scored);

    const items = scored.map<ItinerarioDto>(({ vuelo, precio, familia }) => {
      const salida = new Date(vuelo.fechaSalida);
      const llegada = new Date(vuelo.fechaLlegada);
      const distintivos: string[] = [];
      if (vuelo.id === recommended) distintivos.push('RECOMENDADO');
      if (precio === cheapest) distintivos.push('MAS_ECONOMICO');
      if (vuelo.durationMinutes === fastest) distintivos.push('MAS_RAPIDO');

      return {
        itinerarioId: vuelo.id,
        numeroVuelo: vuelo.codigoVuelo,
        operador: { codigo: vuelo.codigoAerolinea, nombre: vuelo.aerolinea },
        origen: place(vuelo.origenIATA),
        destino: place(vuelo.destinoIATA),
        salida: salida.toISOString(),
        llegada: llegada.toISOString(),
        duracionMinutos: vuelo.durationMinutes,
        escalas: 0,
        cruceDeDia: salida.toISOString().slice(0, 10) !== llegada.toISOString().slice(0, 10),
        precioDesde: money(precio, mercado.moneda),
        familiaDesde: familia.code,
        distintivos,
        ultimosAsientos: vuelo.asientosDisponibles <= SCARCITY_THRESHOLD,
      };
    });

    return this.ordenar(items, scored, sort, recommended);
  }

  /**
   * RF-ANL-005 will feed "Recomendado" from a model; until then it is a transparent weighted
   * score (price 50%, duration 30%, departure inconvenience 20%), the lowest being the best.
   */
  private recomendado(scored: ScoredFlight[]): string {
    const prices = scored.map((s) => s.precio);
    const durations = scored.map((s) => s.vuelo.durationMinutes);
    const norm = (value: number, all: number[]) => {
      const min = Math.min(...all);
      const max = Math.max(...all);
      return max === min ? 0 : (value - min) / (max - min);
    };
    // Departures between 06:00 and 22:00 UTC are "reasonable"; the further outside, the worse.
    const inconvenience = (vuelo: Vuelo) => {
      const hour = new Date(vuelo.fechaSalida).getUTCHours();
      return hour >= 6 && hour <= 22 ? 0 : 1;
    };
    return scored
      .map((s) => ({ id: s.vuelo.id, score: 0.5 * norm(s.precio, prices) + 0.3 * norm(s.vuelo.durationMinutes, durations) + 0.2 * inconvenience(s.vuelo) }))
      .reduce((best, current) => (current.score < best.score ? current : best)).id;
  }

  private ordenar(items: ItinerarioDto[], scored: ScoredFlight[], sort: Ordenamiento, recommendedId: string): ItinerarioDto[] {
    const price = new Map(scored.map((s) => [s.vuelo.id, s.precio]));
    const by = (key: (i: ItinerarioDto) => number) => [...items].sort((a, b) => key(a) - key(b) || a.salida.localeCompare(b.salida));

    switch (sort) {
      case 'MAS_BARATOS':
        return by((i) => price.get(i.itinerarioId)!);
      case 'MAS_RAPIDOS':
        return by((i) => i.duracionMinutos);
      case 'SALIDA_TEMPRANO':
        return by((i) => new Date(i.salida).getTime());
      case 'SALIDA_TARDE':
        return by((i) => -new Date(i.salida).getTime());
      case 'LLEGADA_TEMPRANO':
        return by((i) => new Date(i.llegada).getTime());
      case 'LLEGADA_TARDE':
        return by((i) => -new Date(i.llegada).getTime());
      default:
        // RECOMENDADO: the recommended itinerary first, then by price.
        return by((i) => (i.itinerarioId === recommendedId ? Number.NEGATIVE_INFINITY : price.get(i.itinerarioId)!));
    }
  }

  /** RF-SHP-024: when a day has no flights, show the nearest days that do, with their lowest price. */
  private async fechasAlternativas(origin: string, destination: string, fecha: string, seats: number, familias: FareFamily[], mercado: Mercado): Promise<FechaAlternativaDto[]> {
    const { start } = utcDayRange(fecha);
    const from = new Date(start.getTime() - ALTERNATIVE_DAYS * 86_400_000);
    const to = new Date(start.getTime() + (ALTERNATIVE_DAYS + 1) * 86_400_000);

    const flights = await this.vuelos
      .createQueryBuilder('v')
      .where('v."origenIATA" = :origin AND v."destinoIATA" = :destination', { origin, destination })
      .andWhere('v."fechaSalida" >= :from AND v."fechaSalida" < :to AND v."fechaSalida" > :now', { from, to, now: new Date() })
      .andWhere('v."asientosDisponibles" >= :seats', { seats })
      .getMany();

    const lowestPerDay = new Map<string, number>();
    for (const vuelo of flights) {
      const day = toIso(vuelo.fechaSalida).slice(0, 10);
      const price = this.precios.precioDesde(vuelo, familias, mercado).totalMinor;
      lowestPerDay.set(day, Math.min(lowestPerDay.get(day) ?? Number.POSITIVE_INFINITY, price));
    }
    return [...lowestPerDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, price]) => ({ fecha: day, precioDesde: money(price, mercado.moneda) }));
  }
}
