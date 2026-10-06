import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import type { AuthClaims } from '../../auth/token.service';
import {
  assertGroupSize,
  assertInfantAssociations,
  assertInfantRatio,
  assertNoDuplicatePassengers,
  assertPassengerTypeMatchesAge,
} from '../../common/business-rules';
import { toIso } from '../../common/date.util';
import { DomainEventBus } from '../../common/domain-event-bus';
import { PASSENGER_TYPES, PassengerBreakdown, countFor } from '../../common/pricing.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { seatExists, buildSeatGrid } from '../../common/seat-grid';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import { FareFamily } from '../../entities/fare-family.entity';
import { SeatAssignment } from '../../entities/seat-assignment.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { IdempotencyService } from '../../services/idempotency.service';
import { OffersService } from '../../services/offers.service';
import { SearchService } from '../../services/search.service';
import { Localidad } from '../catalogo/entities/localidad.entity';
import { PreciosService } from '../catalogo/precios.service';
import { formatAmount, minorDigits, money, parseAmountMinor } from '../common/moneda.util';
import { normalizarNombrePasajero } from '../common/texto.util';
import { Mercado } from '../mercados/entities/mercado.entity';
import { SlidingWindowLimiter, assertWithinLimit } from '../common/rate-limiter';
import { MercadosService } from '../mercados/mercados.service';
import {
  AceptarCondicionesDto,
  AceptarPrecioDto,
  ArmarOfertaDto,
  FacturacionDto,
  MapaAsientosViewDto,
  MedioPagoViewDto,
  OfertaViewDto,
  RegistrarPasajerosDto,
  RevalidacionViewDto,
} from './dto/ofertas.dto';
import { DatosPasajeros, Oferta, PasajeroDatos, TrayectoOferta } from './entities/oferta.entity';

const ROUTE_ARMAR = 'POST /ofertas';
// A purchase marked EN_PAGO longer than this is considered abandoned (crash) and may be taken over.
const STALE_PAYMENT_MS = 120_000;
const ACTIVE: Oferta['estado'][] = ['ABIERTA', 'EN_REVISION_PRECIO'];

const toGds = (c: { adultos: number; jovenes: number; ninos: number; infantes: number }): PassengerBreakdown => ({
  adults: c.adultos,
  youths: c.jovenes,
  children: c.ninos,
  infants: c.infantes,
});

const notFound = (id: string) =>
  new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Offer not found', `Offer ${id} was not found.`);

/**
 * D06 offer/cart + D07 checkout data. An offer ties a priced selection to a real inventory hold
 * in the flight core, so what the customer sees is held, not just quoted; it either becomes an
 * order (see ordenes/compras.service.ts) or expires and gives the seats back.
 */
@Injectable()
export class OfertasService implements OnModuleInit {
  // Each offer holds inventory, so building offers is limited per customer, not only per address.
  private readonly buildLimiter = new SlidingWindowLimiter(30, 60_000);

  constructor(
    @InjectRepository(Oferta) private readonly ofertas: Repository<Oferta>,
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    @InjectRepository(SeatAssignment) private readonly asientosTomados: Repository<SeatAssignment>,
    @InjectRepository(FareFamily) private readonly familias: Repository<FareFamily>,
    @InjectRepository(Localidad) private readonly localidades: Repository<Localidad>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
    private readonly search: SearchService,
    private readonly gdsOffers: OffersService,
    private readonly idempotency: IdempotencyService,
    private readonly events: DomainEventBus,
    private readonly mercados: MercadosService,
    private readonly precios: PreciosService,
  ) {}

  onModuleInit(): void {
    // The flight core expires holds (lazily and from its sweeper); the offers they back follow.
    this.events.subscribe('hold.expired', async (event) => {
      const { holdId } = event.payload as { holdId: string };
      const result = await this.ofertas
        .createQueryBuilder()
        .update(Oferta)
        .set({ estado: 'VENCIDA' })
        .where('"holdId" = :holdId AND estado IN (:...states)', { holdId, states: ACTIVE })
        .returning('"ofertaId", "mercado"')
        .execute();
      for (const row of result.raw as { ofertaId: string; mercado: string }[]) {
        await this.events.publish('OfertaVencida', row.ofertaId, { ofertaId: row.ofertaId }, { market: row.mercado });
      }
    });
  }

  // ---------------------------------------------------------------- build / read / cancel

  async armar(auth: AuthClaims, key: string, dto: ArmarOfertaDto): Promise<OfertaViewDto> {
    assertWithinLimit(this.buildLimiter, `offer:${auth.ownerId}`, 'Too many offers requested');
    const mercado = await this.mercados.requerirActivo(dto.mercado);
    const composicion = toGds({ adultos: dto.pasajeros.adultos, jovenes: dto.pasajeros.jovenes ?? 0, ninos: dto.pasajeros.ninos ?? 0, infantes: dto.pasajeros.infantes ?? 0 });
    assertInfantRatio(composicion);
    assertGroupSize(composicion, this.config.maxPassengersPerOrder);

    const scope = { key, route: ROUTE_ARMAR, ownerId: auth.ownerId, body: dto };
    const build = (manager: EntityManager) => this.armarEnTransaccion(manager, auth.ownerId, dto, mercado, composicion);

    let outcome;
    try {
      outcome = await this.idempotency.execute(scope, HttpStatus.CREATED, build);
    } catch (error) {
      // Seats can look sold out only because overdue holds were not swept yet: free them and retry once.
      const soldOut = error instanceof ProblemDetailsException && (error.getResponse() as { code?: string }).code === 'SEAT_TAKEN';
      if (!soldOut || (await this.gdsOffers.expireDueHolds()) === 0) throw error;
      outcome = await this.idempotency.execute(scope, HttpStatus.CREATED, build);
    }

    if (!outcome.replayed) {
      await this.events.publish('OfertaCreada', outcome.result.ofertaId, { ofertaId: outcome.result.ofertaId }, { market: mercado.codigo });
    }
    return outcome.result;
  }

  private async armarEnTransaccion(
    manager: EntityManager,
    ownerId: string,
    dto: ArmarOfertaDto,
    mercado: Mercado,
    composicion: PassengerBreakdown,
  ): Promise<OfertaViewDto> {
    const ids = dto.selecciones.map((s) => s.itinerarioId);
    if (new Set(ids).size !== ids.length) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Duplicate itinerary', 'Each leg must be a different itinerary.', [{ name: 'selecciones', reason: 'duplicate itinerarioId' }]);
    }

    const found = await manager.find(Vuelo, { where: { id: In(ids) } });
    const vuelos = ids.map((id) => found.find((v) => v.id === id));
    vuelos.forEach((vuelo, index) => {
      if (!vuelo || new Date(vuelo.fechaSalida).getTime() <= Date.now()) {
        throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'OFFER_NO_LONGER_AVAILABLE', 'Itinerary not available', `Itinerary ${ids[index]} does not exist or has already departed.`);
      }
    });
    const legs = vuelos as Vuelo[];

    if (legs.length === 2) {
      const [ida, vuelta] = legs;
      // RN-04: the return does not precede the outbound; a round trip returns to where it started.
      if (vuelta.origenIATA !== ida.destinoIATA || vuelta.destinoIATA !== ida.origenIATA || new Date(vuelta.fechaSalida) < new Date(ida.fechaLlegada)) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Invalid round trip', 'The return must start where the outbound ends, after it lands.', [
          { name: 'selecciones', reason: 'return leg does not follow the outbound leg' },
        ]);
      }
    }

    const codigos = dto.selecciones.map((s) => s.familia);
    const familias = await manager.find(FareFamily, { where: { code: In(codigos) } });
    for (const codigo of codigos) {
      if (!familias.some((f) => f.code === codigo)) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Unknown fare family', `The fare family ${codigo} does not exist.`, [{ name: 'selecciones.familia', reason: 'unknown fare family' }]);
      }
    }

    // One transaction: the flight core's offer, its inventory hold and ours are created together.
    const gdsOffer = await this.search.createOfferWithin(manager, legs, composicion);
    const hold = await this.gdsOffers.createHoldWithin(manager, ownerId, {
      offerId: gdsOffer.offerId,
      itinerarySelections: gdsOffer.itineraries.map((itinerary, index) => ({ itineraryId: itinerary.itineraryId, cabinClass: 'ECONOMY', fareBrand: codigos[index] })),
      passengersBreakdown: composicion,
    });

    const trayectos = legs.map((vuelo, index) =>
      this.armarTrayecto(vuelo, familias.find((f) => f.code === codigos[index])!, gdsOffer.itineraries[index].itineraryId, composicion, mercado),
    );

    const oferta = await manager.save(
      manager.create(Oferta, {
        mercado: mercado.codigo,
        moneda: mercado.moneda,
        ownerId,
        estado: 'ABIERTA',
        trayectos,
        composicion: { adultos: composicion.adults, jovenes: composicion.youths, ninos: composicion.children, infantes: composicion.infants },
        totalMinor: trayectos.reduce((sum, t) => sum + t.totalMinor, 0),
        totalPropuestoMinor: null,
        gdsOfferId: gdsOffer.offerId,
        holdId: hold.holdId,
        venceEn: new Date(hold.expiresAt),
      }),
    );
    return this.vista(oferta);
  }

  async obtener(auth: AuthClaims, id: string): Promise<OfertaViewDto> {
    return this.vista(await this.cargarVigente(auth, id));
  }

  async cancelar(auth: AuthClaims, id: string): Promise<void> {
    const oferta = await this.cargarVigente(auth, id);
    if (!ACTIVE.includes(oferta.estado)) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'OFFER_NOT_PAYABLE', 'Offer cannot be cancelled', `The offer is ${oferta.estado}.`);
    }
    await this.gdsOffers.releaseHold(oferta.ownerId, oferta.holdId);
    await this.ofertas.update({ ofertaId: oferta.ofertaId, estado: In(ACTIVE) }, { estado: 'CANCELADA' });
  }

  // ---------------------------------------------------------------- revalidation (RF-CRT-003, RN-12)

  async revalidar(auth: AuthClaims, id: string): Promise<RevalidacionViewDto> {
    const oferta = await this.cargarVigente(auth, id);
    this.exigirActiva(oferta);

    const hold = await this.gdsOffers.getHoldStatus(oferta.ownerId, oferta.holdId);
    if (hold.status !== 'HELD') {
      await this.marcarVencida(oferta);
      throw this.vencida(oferta);
    }

    const mercado = await this.mercados.requerirActivo(oferta.mercado);
    const nuevos = await this.recotizar(oferta, mercado);
    if (!nuevos) {
      await this.marcarVencida(oferta);
      throw this.vencida(oferta);
    }
    const nuevoTotal = nuevos.reduce((sum, t) => sum + t.totalMinor, 0);

    if (nuevoTotal !== oferta.totalMinor) {
      // RN-12: the new price prevails, but nothing proceeds until the customer accepts it.
      await this.ofertas.update(oferta.ofertaId, { estado: 'EN_REVISION_PRECIO', totalPropuestoMinor: nuevoTotal });
    } else {
      await this.ofertas.update(oferta.ofertaId, { estado: 'ABIERTA', totalPropuestoMinor: null, revalidadaEn: new Date() });
    }

    return {
      vigente: true,
      cambioDePrecio: nuevoTotal !== oferta.totalMinor,
      precioAnterior: money(oferta.totalMinor, oferta.moneda),
      precioNuevo: money(nuevoTotal, oferta.moneda),
      venceEn: oferta.venceEn.toISOString(),
    };
  }

  async aceptarPrecio(auth: AuthClaims, id: string, dto: AceptarPrecioDto): Promise<OfertaViewDto> {
    const oferta = await this.cargarVigente(auth, id);
    if (oferta.estado !== 'EN_REVISION_PRECIO') {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'OFFER_NOT_PAYABLE', 'No price change to accept', 'The offer has no pending price change.');
    }

    // Re-quote once more: what is accepted must be what will be charged, not a stale figure.
    const mercado = await this.mercados.requerirActivo(oferta.mercado);
    const nuevos = await this.recotizar(oferta, mercado);
    if (!nuevos) {
      await this.marcarVencida(oferta);
      throw this.vencida(oferta);
    }
    const total = nuevos.reduce((sum, t) => sum + t.totalMinor, 0);
    const aceptado = parseAmountMinor(dto.totalAceptado, oferta.moneda);
    if (aceptado === null) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Invalid amount', `${oferta.moneda} amounts have at most ${minorDigits(oferta.moneda)} decimals.`, [
        { name: 'totalAceptado', reason: `must be an amount in ${oferta.moneda}` },
      ]);
    }
    // Amounts are compared in minor units, so "1234.5" and "1234.50" are the same figure.
    if (aceptado !== total) {
      await this.ofertas.update(oferta.ofertaId, { totalPropuestoMinor: total });
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'PRICE_CHANGED', 'The price changed again', `The current total is ${formatAmount(total, oferta.moneda)} ${oferta.moneda}, not ${dto.totalAceptado}.`);
    }

    oferta.trayectos = nuevos;
    oferta.totalMinor = total;
    oferta.totalPropuestoMinor = null;
    oferta.estado = 'ABIERTA';
    oferta.revalidadaEn = new Date();
    return this.vista(await this.ofertas.save(oferta));
  }

  // ---------------------------------------------------------------- checkout data (D07)

  async registrarPasajeros(auth: AuthClaims, id: string, dto: RegistrarPasajerosDto): Promise<OfertaViewDto> {
    const oferta = await this.cargarVigente(auth, id);
    this.exigirActiva(oferta);

    // The party must be the one that was priced and held.
    const esperado = toGds(oferta.composicion);
    for (const tipo of PASSENGER_TYPES) {
      const recibidos = dto.pasajeros.filter((p) => p.tipo === tipo).length;
      if (recibidos !== countFor(esperado, tipo)) {
        throw new ProblemDetailsException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          'Passengers do not match the offer',
          `The offer was built for ${countFor(esperado, tipo)} ${tipo} passenger(s) but ${recibidos} were provided.`,
          [{ name: 'pasajeros', reason: `expected ${countFor(esperado, tipo)} ${tipo}` }],
        );
      }
    }

    const advertencias: string[] = [];
    const pasajeros: PasajeroDatos[] = dto.pasajeros.map((p) => {
      const nombres = normalizarNombrePasajero(p.nombres);
      const apellidos = normalizarNombrePasajero(p.apellidos);
      if (!nombres || !apellidos) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Invalid name', `The name of passenger ${p.id} has no valid characters.`, [{ name: 'pasajeros.nombres', reason: 'no valid characters' }]);
      }
      if (nombres !== p.nombres.trim() || apellidos !== p.apellidos.trim()) {
        advertencias.push(`El nombre de ${p.id} se normalizó a "${nombres} ${apellidos}"; debe coincidir con el documento de viaje.`);
      }
      return {
        id: p.id,
        tipo: p.tipo,
        asociadoA: p.asociadoA,
        nombres,
        apellidos,
        fechaNacimiento: p.fechaNacimiento,
        genero: p.genero,
        nacionalidad: p.nacionalidad,
        documento: { tipo: p.documento.tipo, numero: p.documento.numero.toUpperCase(), vencimiento: p.documento.vencimiento },
        numeroSocio: p.numeroSocio,
        necesidades: p.necesidades,
        ...(p.asientos?.length ? { asientos: p.asientos.map((a) => ({ trayectoId: a.trayectoId, asiento: a.asiento })) } : {}),
      };
    });

    assertNoDuplicatePassengers(pasajeros.map((p) => ({ passengerId: p.id, firstName: p.nombres, lastName: p.apellidos, birthDate: p.fechaNacimiento, documentNumber: p.documento.numero })));
    assertInfantAssociations(pasajeros.map((p) => ({ passengerId: p.id, passengerType: p.tipo, associatedAdultId: p.asociadoA })));

    // RN-14: the type follows from the age on the day of the first flight.
    const primerVuelo = oferta.trayectos[0].salida;
    const ultimoVuelo = oferta.trayectos[oferta.trayectos.length - 1].salida;
    for (const p of pasajeros) {
      assertPassengerTypeMatchesAge(p.tipo, p.fechaNacimiento, primerVuelo);
    }

    // RF-CHK-002: the document expiry is required when a leg crosses a border, and must outlast the trip.
    const internacional = await this.esInternacional(oferta);
    for (const p of pasajeros) {
      const vencimiento = p.documento.vencimiento;
      if (internacional && !vencimiento) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Document expiry required', 'International itineraries require the document expiry date.', [
          { name: 'pasajeros.documento.vencimiento', reason: 'required for international itineraries' },
        ]);
      }
      if (vencimiento && new Date(vencimiento) < new Date(ultimoVuelo)) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Travel document expired', `The document of ${p.id} expires before the trip ends.`, [
          { name: 'pasajeros.documento.vencimiento', reason: 'expires before the end of the trip' },
        ]);
      }
    }

    // Optional seat picks: checked now so the customer hears about a problem before paying.
    await this.verificarAsientos(oferta, pasajeros);

    const datos: DatosPasajeros = { pasajeros, contacto: { correo: dto.contacto.correo, telefono: dto.contacto.telefono } };
    oferta.datosPasajeros = datos;
    const guardada = await this.ofertas.save(oferta);
    return { ...this.vista(guardada), ...(advertencias.length ? { advertencias } : {}) };
  }

  // ---------------------------------------------------------------- seats

  /** The seat map of one leg of the offer: which seats exist and which are already taken. */
  async mapaAsientos(auth: AuthClaims, id: string, trayectoId: string): Promise<MapaAsientosViewDto> {
    const oferta = await this.cargarVigente(auth, id);
    const trayecto = oferta.trayectos.find((t) => t.itinerarioId === trayectoId);
    if (!trayecto) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Leg not part of the offer', `trayectoId ${trayectoId} does not belong to offer ${id}.`, [
        { name: 'trayectoId', reason: 'does not belong to the offer' },
      ]);
    }
    const vuelo = await this.vuelos.findOne({ where: { id: trayectoId } });
    if (!vuelo) {
      throw new ProblemDetailsException(HttpStatus.GONE, 'OFFER_NO_LONGER_AVAILABLE', 'Flight no longer available', 'The flight behind this leg no longer exists.');
    }
    const ocupados = new Set((await this.asientosTomados.find({ where: { vueloId: vuelo.id } })).map((s) => s.seatNumber));
    const filas = buildSeatGrid(vuelo.capacidadTotal).map((fila) => ({
      rowNumber: fila.rowNumber,
      seats: fila.seats.map((seat) => ({ seatNumber: seat.seatNumber, isAvailable: !ocupados.has(seat.seatNumber), characteristics: seat.characteristics })),
    }));
    return { trayectoId, numeroVuelo: trayecto.numeroVuelo, filas };
  }

  /**
   * Checks the seats the passengers picked: they belong to a leg of the offer, exist in the cabin,
   * are not for a lap infant, are not repeated, and are still free. The unique index on
   * (flight, seat) stays the final guarantee when two purchases race for the same seat.
   */
  async verificarAsientos(oferta: Oferta, pasajeros: PasajeroDatos[]): Promise<void> {
    const elegidos = pasajeros.flatMap((p) => (p.asientos ?? []).map((a) => ({ pasajero: p, ...a })));
    if (elegidos.length === 0) return;

    const vuelos = await this.vuelos.find({ where: { id: In(oferta.trayectos.map((t) => t.itinerarioId)) } });
    const vistos = new Set<string>();
    const porPasajeroYTrayecto = new Set<string>();

    for (const e of elegidos) {
      if (e.pasajero.tipo === 'INFANT') {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'INFANT_SEAT_NOT_ALLOWED', 'Infants cannot have a seat', `Passenger ${e.pasajero.id} is a lap infant.`, [
          { name: 'pasajeros.asientos', reason: 'a lap infant has no seat' },
        ]);
      }
      const vuelo = vuelos.find((v) => v.id === e.trayectoId);
      if (!vuelo) {
        throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Leg not part of the offer', `trayectoId ${e.trayectoId} does not belong to this offer.`, [
          { name: 'pasajeros.asientos.trayectoId', reason: 'does not belong to the offer' },
        ]);
      }
      if (!seatExists(vuelo.capacidadTotal, e.asiento)) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'SEAT_CABIN_MISMATCH', 'Seat does not exist', `Seat ${e.asiento} does not exist on flight ${vuelo.codigoVuelo}.`, [
          { name: 'pasajeros.asientos.asiento', reason: 'seat does not exist on this flight' },
        ]);
      }
      const clavePasajero = `${e.pasajero.id}:${e.trayectoId}`;
      if (porPasajeroYTrayecto.has(clavePasajero)) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Several seats on one leg', `Passenger ${e.pasajero.id} has more than one seat on a leg.`, [
          { name: 'pasajeros.asientos', reason: 'one seat per passenger and leg' },
        ]);
      }
      porPasajeroYTrayecto.add(clavePasajero);
      const claveAsiento = `${e.trayectoId}:${e.asiento}`;
      if (vistos.has(claveAsiento)) {
        throw new ProblemDetailsException(HttpStatus.CONFLICT, 'SEAT_TAKEN', 'Seat requested twice', `Seat ${e.asiento} is assigned to more than one passenger.`);
      }
      vistos.add(claveAsiento);
    }

    const ocupados = await this.asientosTomados.find({ where: elegidos.map((e) => ({ vueloId: e.trayectoId, seatNumber: e.asiento })) });
    if (ocupados.length > 0) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'SEAT_TAKEN', 'Seat already taken', `Seat ${ocupados.map((o) => o.seatNumber).join(', ')} was just taken by another booking. Choose another seat.`);
    }
  }

  async registrarFacturacion(auth: AuthClaims, id: string, dto: FacturacionDto): Promise<OfertaViewDto> {
    const oferta = await this.cargarVigente(auth, id);
    this.exigirActiva(oferta);

    const mercado = await this.mercados.obtener(oferta.mercado);
    const regla = mercado.identificacionesFiscales.find((i) => i.tipo === dto.tipoIdentificacion);
    if (!regla) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Tax id type not accepted', `The market "${mercado.codigo}" accepts: ${mercado.identificacionesFiscales.map((i) => i.tipo).join(', ')}.`, [
        { name: 'tipoIdentificacion', reason: 'not accepted in this market' },
      ]);
    }
    if (!new RegExp(`^(?:${regla.patron})$`).test(dto.numeroIdentificacion)) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Invalid tax id', `The number does not match ${regla.etiqueta}.`, [{ name: 'numeroIdentificacion', reason: `must match ${regla.etiqueta}` }]);
    }

    oferta.facturacion = {
      tipoIdentificacion: dto.tipoIdentificacion,
      numeroIdentificacion: dto.numeroIdentificacion,
      razonSocial: dto.razonSocial.trim(),
      direccion: dto.direccion.trim(),
      pais: dto.pais,
    };
    return this.vista(await this.ofertas.save(oferta));
  }

  /** RF-CHK-012: an express acceptance of the versions in force, recorded with its time. */
  async aceptarCondiciones(auth: AuthClaims, id: string, dto: AceptarCondicionesDto): Promise<OfertaViewDto> {
    const oferta = await this.cargarVigente(auth, id);
    this.exigirActiva(oferta);

    const mercado = await this.mercados.obtener(oferta.mercado);
    const { terminos, condicionesTransporte } = mercado.textosLegales;
    if (dto.versionTerminos !== terminos.version || dto.versionCondicionesTransporte !== condicionesTransporte.version) {
      throw new ProblemDetailsException(
        HttpStatus.CONFLICT,
        'CONDITIONS_VERSION_MISMATCH',
        'The conditions changed',
        `The versions in force are terminos=${terminos.version} and condicionesTransporte=${condicionesTransporte.version}. Show them to the customer again.`,
      );
    }

    oferta.condicionesAceptadas = { terminos: terminos.version, condicionesTransporte: condicionesTransporte.version, aceptadoEn: new Date().toISOString() };
    return this.vista(await this.ofertas.save(oferta));
  }

  /** RF-PAY-001: the methods depend on the market, currency and product (a ticket, here). */
  async mediosDePago(auth: AuthClaims, id: string): Promise<MedioPagoViewDto[]> {
    const oferta = await this.cargarVigente(auth, id);
    const mercado = await this.mercados.obtener(oferta.mercado);
    return mercado.mediosPago
      .filter((medio) => medio.productos.includes('PASAJE'))
      .map(({ tipo, marcas, cuotasPermitidas }) => ({ tipo, marcas, cuotasPermitidas }));
  }

  // ---------------------------------------------------------------- purchase support (used by the order saga)

  /**
   * Locks the offer for one purchase attempt: only one attempt can hold it, it must be complete
   * and payable, and a stale lock left by a crashed attempt can be taken over.
   */
  async bloquearParaPago(auth: AuthClaims, ofertaId: string): Promise<Oferta> {
    return this.dataSource.transaction(async (manager) => {
      const oferta = await manager.findOne(Oferta, { where: { ofertaId }, lock: { mode: 'pessimistic_write' } });
      if (!oferta) throw notFound(ofertaId);
      this.exigirPropietario(oferta, auth);

      switch (oferta.estado) {
        case 'VENCIDA':
          throw this.vencida(oferta);
        case 'EN_REVISION_PRECIO':
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'PRICE_CHANGED', 'The price changed', 'Accept the new price before paying.');
        case 'PAGADA':
        case 'CANCELADA':
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'OFFER_NOT_PAYABLE', 'Offer cannot be paid', `The offer is ${oferta.estado}.`);
        case 'EN_PAGO':
          if (oferta.enPagoDesde && Date.now() - oferta.enPagoDesde.getTime() < STALE_PAYMENT_MS) {
            throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CONFLICT', 'Payment in progress', 'Another payment attempt for this offer is still running.');
          }
          break;
        default:
          break;
      }

      if (oferta.venceEn.getTime() <= Date.now()) throw this.vencida(oferta);

      const faltantes = this.faltantes(oferta);
      if (faltantes.length > 0) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'OFFER_INCOMPLETE', 'The offer is incomplete', `Missing before payment: ${faltantes.join(', ')}.`, faltantes.map((f) => ({ name: f, reason: 'required before payment' })));
      }

      oferta.estado = 'EN_PAGO';
      oferta.enPagoDesde = new Date();
      return manager.save(oferta);
    });
  }

  /**
   * RF-CRT-003 for a purchase in progress: runs while this attempt holds the offer (EN_PAGO), so no
   * other attempt can interleave. An expired hold or a changed price ends the attempt and moves the
   * offer to the state the customer must act on, instead of charging.
   */
  async revalidarBloqueada(oferta: Oferta): Promise<void> {
    const alVencer = async (): Promise<never> => {
      await this.ofertas.update({ ofertaId: oferta.ofertaId, estado: 'EN_PAGO' }, { estado: 'VENCIDA', enPagoDesde: null });
      await this.events.publish('OfertaVencida', oferta.ofertaId, { ofertaId: oferta.ofertaId }, { market: oferta.mercado });
      throw this.vencida(oferta);
    };

    const hold = await this.gdsOffers.getHoldStatus(oferta.ownerId, oferta.holdId);
    if (hold.status !== 'HELD') return alVencer();

    const mercado = await this.mercados.requerirActivo(oferta.mercado);
    const nuevos = await this.recotizar(oferta, mercado);
    if (!nuevos) return alVencer();

    const nuevoTotal = nuevos.reduce((sum, t) => sum + t.totalMinor, 0);
    if (nuevoTotal !== oferta.totalMinor) {
      await this.ofertas.update({ ofertaId: oferta.ofertaId, estado: 'EN_PAGO' }, { estado: 'EN_REVISION_PRECIO', totalPropuestoMinor: nuevoTotal, enPagoDesde: null });
      throw new ProblemDetailsException(
        HttpStatus.CONFLICT,
        'PRICE_CHANGED',
        'The price changed',
        `The new total is ${formatAmount(nuevoTotal, oferta.moneda)} ${oferta.moneda} (it was ${formatAmount(oferta.totalMinor, oferta.moneda)}). Accept it and pay again.`,
      );
    }
    await this.ofertas.update(oferta.ofertaId, { revalidadaEn: new Date() });
  }

  async marcarPagada(manager: EntityManager, ofertaId: string): Promise<void> {
    await manager.update(Oferta, { ofertaId, estado: 'EN_PAGO' }, { estado: 'PAGADA', enPagoDesde: null });
  }

  /** Gives the offer back after a failed attempt so the customer can retry with another method (RF-PAY-009). */
  async liberarPago(ofertaId: string, destino: 'ABIERTA' | 'VENCIDA'): Promise<void> {
    await this.ofertas.update({ ofertaId, estado: 'EN_PAGO' }, { estado: destino, enPagoDesde: null });
  }

  // ---------------------------------------------------------------- helpers

  vista(oferta: Oferta): OfertaViewDto {
    const activa = ACTIVE.includes(oferta.estado) || oferta.estado === 'EN_PAGO';
    const pasajeros = oferta.datosPasajeros?.pasajeros;
    return {
      ofertaId: oferta.ofertaId,
      estado: oferta.estado,
      mercado: oferta.mercado,
      moneda: oferta.moneda,
      trayectos: oferta.trayectos.map((t) => ({
        itinerarioId: t.itinerarioId,
        numeroVuelo: t.numeroVuelo,
        origen: t.origen,
        destino: t.destino,
        salida: t.salida,
        llegada: t.llegada,
        familia: t.familia,
        total: money(t.totalMinor, oferta.moneda),
      })),
      pasajeros: oferta.composicion,
      total: money(oferta.totalMinor, oferta.moneda),
      ...(oferta.totalPropuestoMinor !== null ? { precioPendienteDeAceptar: money(oferta.totalPropuestoMinor, oferta.moneda) } : {}),
      venceEn: toIso(oferta.venceEn),
      segundosRestantes: activa ? Math.max(0, Math.floor((oferta.venceEn.getTime() - Date.now()) / 1000)) : 0,
      faltantes: this.faltantes(oferta),
      ...(pasajeros ? { pasajerosRegistrados: pasajeros.map((p) => ({ id: p.id, tipo: p.tipo, nombres: p.nombres, apellidos: p.apellidos, ...(p.asientos?.length ? { asientos: p.asientos } : {}) })) } : {}),
      ...(oferta.condicionesAceptadas ? { condicionesAceptadas: oferta.condicionesAceptadas } : {}),
      _links: {
        self: `/api/v1/ofertas/${oferta.ofertaId}`,
        revalidacion: `/api/v1/ofertas/${oferta.ofertaId}/revalidacion`,
        pasajeros: `/api/v1/ofertas/${oferta.ofertaId}/pasajeros`,
        asientos: `/api/v1/ofertas/${oferta.ofertaId}/asientos`,
        compra: `/api/v1/ofertas/${oferta.ofertaId}/compra`,
      },
    };
  }

  faltantes(oferta: Oferta): string[] {
    const faltantes: string[] = [];
    if (!oferta.datosPasajeros) faltantes.push('PASAJEROS');
    if (!oferta.facturacion) faltantes.push('FACTURACION');
    if (!oferta.condicionesAceptadas) faltantes.push('CONDICIONES');
    if (oferta.estado === 'EN_REVISION_PRECIO') faltantes.push('ACEPTAR_PRECIO');
    return faltantes;
  }

  /** Loads an offer the caller owns, expiring it first if its time ran out (RF-CRT-005). */
  async cargarVigente(auth: AuthClaims, id: string): Promise<Oferta> {
    const oferta = await this.ofertas.findOne({ where: { ofertaId: id } });
    if (!oferta) throw notFound(id);
    this.exigirPropietario(oferta, auth);

    if (ACTIVE.includes(oferta.estado) && oferta.venceEn.getTime() <= Date.now()) {
      await this.marcarVencida(oferta);
      oferta.estado = 'VENCIDA';
    }
    return oferta;
  }

  private exigirPropietario(oferta: Oferta, auth: AuthClaims): void {
    if (oferta.ownerId !== auth.ownerId) {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Offer belongs to another user', 'You do not have access to this offer.');
    }
  }

  private exigirActiva(oferta: Oferta): void {
    if (oferta.estado === 'VENCIDA') throw this.vencida(oferta);
    if (!ACTIVE.includes(oferta.estado)) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'OFFER_NOT_PAYABLE', 'Offer cannot be modified', `The offer is ${oferta.estado}.`);
    }
  }

  private vencida(oferta: Oferta): ProblemDetailsException {
    return new ProblemDetailsException(HttpStatus.GONE, 'OFFER_EXPIRED', 'Offer expired', `Offer ${oferta.ofertaId} expired; its seats were released. Search again.`);
  }

  private async marcarVencida(oferta: Oferta): Promise<void> {
    const result = await this.ofertas.update({ ofertaId: oferta.ofertaId, estado: In(ACTIVE) }, { estado: 'VENCIDA' });
    await this.gdsOffers.expireIfDue(oferta.holdId);
    if (result.affected) {
      await this.events.publish('OfertaVencida', oferta.ofertaId, { ofertaId: oferta.ofertaId }, { market: oferta.mercado });
    }
  }

  private armarTrayecto(vuelo: Vuelo, familia: FareFamily, gdsItinerarioId: string, composicion: PassengerBreakdown, mercado: Mercado): TrayectoOferta {
    const cotizacion = this.precios.cotizar(vuelo, familia, composicion, mercado);
    return {
      itinerarioId: vuelo.id,
      gdsItinerarioId,
      familia: familia.code,
      numeroVuelo: vuelo.codigoVuelo,
      operadorCodigo: vuelo.codigoAerolinea,
      operadorNombre: vuelo.aerolinea,
      origen: vuelo.origenIATA,
      destino: vuelo.destinoIATA,
      salida: toIso(vuelo.fechaSalida),
      llegada: toIso(vuelo.fechaLlegada),
      duracionMinutos: vuelo.durationMinutes,
      unitarios: cotizacion.unitarios,
      totalMinor: cotizacion.totalMinor,
    };
  }

  /** Prices the offer again from the live flights and fare families; null when a flight is gone or has left. */
  async recotizar(oferta: Oferta, mercado: Mercado): Promise<TrayectoOferta[] | null> {
    const composicion = toGds(oferta.composicion);
    const vuelos = await this.vuelos.find({ where: { id: In(oferta.trayectos.map((t) => t.itinerarioId)) } });
    const familias = await this.familias.find({ where: { code: In(oferta.trayectos.map((t) => t.familia)) } });

    const nuevos: TrayectoOferta[] = [];
    for (const trayecto of oferta.trayectos) {
      const vuelo = vuelos.find((v) => v.id === trayecto.itinerarioId);
      const familia = familias.find((f) => f.code === trayecto.familia);
      if (!vuelo || !familia || new Date(vuelo.fechaSalida).getTime() <= Date.now()) return null;
      nuevos.push(this.armarTrayecto(vuelo, familia, trayecto.gdsItinerarioId, composicion, mercado));
    }
    return nuevos;
  }

  private async esInternacional(oferta: Oferta): Promise<boolean> {
    const codigos = [...new Set(oferta.trayectos.flatMap((t) => [t.origen, t.destino]))];
    const paises = new Map((await this.localidades.find({ where: { iata: In(codigos) } })).map((l) => [l.iata, l.pais]));
    // An airport missing from the catalog is treated as international: ask for the stricter data.
    return oferta.trayectos.some((t) => !paises.has(t.origen) || !paises.has(t.destino) || paises.get(t.origen) !== paises.get(t.destino));
  }
}
