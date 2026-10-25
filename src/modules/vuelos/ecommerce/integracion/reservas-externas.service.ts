import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthClaims } from '../../auth/token.service';
import { DomainEventBus } from '../../common/domain-event-bus';
import { ProblemDetailsBody, ProblemDetailsException } from '../../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import { IdempotencyService, SagaOutcome } from '../../services/idempotency.service';
import { money } from '../common/moneda.util';
import { SlidingWindowLimiter, assertWithinLimit } from '../common/rate-limiter';
import { DatosFacturacion } from '../facturacion/entities/datos-facturacion.entity';
import { Factura } from '../facturacion/entities/factura.entity';
import { FacturacionService } from '../facturacion/facturacion.service';
import { MercadosService } from '../mercados/mercados.service';
import { SagasRegistroService } from '../observabilidad/sagas-registro.service';
import { PagosService } from '../pagos/pagos.service';
import { RechazoProveedorError } from './acl/adaptador-proveedor';
import { CircuitBreakers } from './acl/circuit-breakers.service';
import { CancelarReservaExternaDto, ReservaExternaViewDto, ReservarExperienciaDto } from './dto/integracion.dto';
import { CatalogoExterno } from './entities/catalogo-externo.entity';
import { Proveedor } from './entities/proveedor.entity';
import { ReservaExterna } from './entities/reserva-externa.entity';
import { ProveedoresService } from './proveedores.service';

const ROUTE_RESERVA = 'POST /experiencias/{id}/reservas';
const ROUTE_CANCELAR = 'POST /reservas-externas/{id}/cancelar';

const problem = (status: HttpStatus, code: ProblemDetailsBody['code'], title: string, detail: string): ProblemDetailsBody => ({
  type: `https://api.booking-hub.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
  title,
  status,
  code,
  detail,
});

/** A stable UUID derived from a seed: the idempotency key the partner sees, so a retry of a step never books twice. */
function uuidDe(semilla: string): string {
  const h = createHash('sha256').update(semilla).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const motivoDe = (error: unknown): string =>
  error instanceof ProblemDetailsException ? String((error.getResponse() as ProblemDetailsBody).code) : error instanceof Error ? error.message.slice(0, 200) : 'unknown_error';

/**
 * Reservation of a partner product (an attraction…) through the platform, as a saga with compensation: authorise the
 * payment → book in the partner system → confirm and invoice here (one transaction) → capture. If the partner refuses
 * or fails, the authorisation is released; if the local confirmation fails after the partner booked, the partner
 * reservation is cancelled and the authorisation released. Idempotent by the Idempotency-Key.
 */
@Injectable()
export class ReservasExternasService {
  private readonly logger = new Logger(ReservasExternasService.name);
  // Card testing: nobody needs more than a few payment attempts a minute.
  private readonly limiter = new SlidingWindowLimiter(10, 60_000);

  constructor(
    @InjectRepository(ReservaExterna) private readonly reservas: Repository<ReservaExterna>,
    @InjectRepository(CatalogoExterno) private readonly catalogo: Repository<CatalogoExterno>,
    @InjectRepository(Proveedor) private readonly proveedores: Repository<Proveedor>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
    private readonly proveedoresService: ProveedoresService,
    private readonly circuitos: CircuitBreakers,
    private readonly pagos: PagosService,
    private readonly facturacion: FacturacionService,
    private readonly mercados: MercadosService,
    private readonly sagas: SagasRegistroService,
    private readonly idempotency: IdempotencyService,
    private readonly events: DomainEventBus,
  ) {}

  async reservar(auth: AuthClaims, catalogoId: string, dto: ReservarExperienciaDto, key: string): Promise<SagaOutcome & { replayed: boolean }> {
    assertWithinLimit(this.limiter, `exp:${auth.ownerId}`, 'Too many reservation attempts');
    const { outcome, replayed } = await this.idempotency.executeSaga({ key, route: ROUTE_RESERVA, ownerId: auth.ownerId, body: { catalogoId, ...dto } }, () => this.saga(auth, catalogoId, dto));
    return { ...outcome, replayed };
  }

  private async saga(auth: AuthClaims, catalogoId: string, dto: ReservarExperienciaDto): Promise<SagaOutcome> {
    // --- preconditions (thrown, never stored under the key) ---
    const producto = await this.catalogo.findOne({ where: { id: catalogoId }, relations: { proveedor: true } });
    if (!producto || !producto.activo || !producto.proveedor.activo) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Experience not available', 'This experience does not exist or is not offered right now.');
    }
    const hoy = new Date().toISOString().slice(0, 10);
    if (dto.fecha < hoy) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid date', 'The date must not be in the past.', [{ name: 'fecha', reason: 'must not be in the past' }]);
    }
    const mercado = await this.mercados.requerirActivo('ec');
    if (producto.moneda !== mercado.moneda) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'MARKET_NOT_AVAILABLE', 'Currency not sold here', `This experience is priced in ${producto.moneda} and the market sells in ${mercado.moneda}.`);
    }
    this.validarMedio(mercado.mediosPago, dto);
    this.validarFacturacion(mercado.identificacionesFiscales, dto);

    // The reservation exists (PENDIENTE) before the payment, which points at it.
    const totalMinor = producto.precioMinor * dto.cantidad;
    const reserva = await this.dataSource.transaction(async (manager) => {
      const datos = await manager.save(
        manager.create(DatosFacturacion, {
          tipoIdentificacion: dto.facturacion.tipoIdentificacion,
          numeroIdentificacion: dto.facturacion.numeroIdentificacion,
          razonSocial: dto.facturacion.razonSocial.trim(),
          direccion: dto.facturacion.direccion.trim(),
          pais: dto.facturacion.pais,
        }),
      );
      return manager.save(
        manager.create(ReservaExterna, {
          ownerId: auth.ownerId,
          clienteId: auth.ownerId.startsWith('guest:') ? null : auth.ownerId,
          proveedorId: producto.proveedorId,
          catalogoId: producto.id,
          externalReservationId: null,
          estado: 'PENDIENTE',
          fecha: dto.fecha,
          hora: dto.hora ?? null,
          cantidad: dto.cantidad,
          nombreCliente: dto.nombre.trim(),
          correoCliente: dto.correo,
          totalMinor,
          moneda: producto.moneda,
          datosFacturacionId: datos.datosFacturacionId,
          motivo: null,
        }),
      );
    });

    const traza = await this.sagas.iniciar('RESERVA_EXTERNA', reserva.id, auth.ownerId);
    const fallar = async (estadoSaga: 'FALLIDA' | 'COMPENSADA', motivo: string, status: HttpStatus, code: ProblemDetailsBody['code'], titulo: string, detalle: string): Promise<SagaOutcome> => {
      await this.reservas.update(reserva.id, { estado: 'FALLIDA_COMPENSADA', motivo: motivo.slice(0, 300) });
      await traza.finalizar(estadoSaga, motivo);
      await this.events.publish('ReservaExternaFallida', reserva.id, { reservaExternaId: reserva.id, proveedorId: producto.proveedorId, motivo }, { market: mercado.codigo }).catch(() => undefined);
      return { status, body: problem(status, code, titulo, detalle) };
    };

    // 1. Payment (ancillaries are never financed: one instalment).
    const autorizacion = await this.pagos.autorizar({
      reservaExternaId: reserva.id,
      ownerId: auth.ownerId,
      mercado,
      montoMinor: totalMinor,
      medio: { token: dto.medio.token, marca: dto.medio.marca },
      cuotas: 1,
      claveIdempotencia: reserva.id,
    });
    if (!autorizacion.ok) {
      const rechazo = autorizacion as Extract<typeof autorizacion, { ok: false }>;
      await traza.paso('AUTORIZAR_PAGO', 'ERROR', rechazo.codigo);
      return fallar('FALLIDA', rechazo.codigo, HttpStatus.PAYMENT_REQUIRED, rechazo.codigo, rechazo.codigo === 'PAYMENT_DECLINED' ? 'Payment declined' : 'Payment rejected', rechazo.detalle);
    }
    const pago = autorizacion.pago;
    await traza.paso('AUTORIZAR_PAGO', 'OK');

    // 2. Booking in the partner system, through its adapter and circuit breaker.
    const adaptador = this.proveedoresService.adaptador(producto.proveedor.tipoServicio);
    const claveProveedor = uuidDe(`reserva:${reserva.id}`);
    let remota;
    try {
      remota = await this.circuitos.ejecutar(producto.proveedorId, () =>
        adaptador.reservar(producto.proveedor.baseUrl, producto.externalId, { fecha: dto.fecha, hora: dto.hora ?? null, cantidad: dto.cantidad, nombre: dto.nombre.trim(), correo: dto.correo }, claveProveedor),
      );
    } catch (error) {
      const motivo = motivoDe(error);
      await traza.paso('RESERVAR_PROVEEDOR', 'ERROR', error instanceof RechazoProveedorError ? error.message : motivo);
      const anulado = await this.pagos.anular(pago);
      await traza.paso('ANULAR_PAGO', 'COMPENSADO', anulado ? 'anulada' : 'anulación pendiente');
      const rechazo = error instanceof RechazoProveedorError;
      return fallar(
        'COMPENSADA',
        rechazo ? `partner_refused:${error.status}` : motivo,
        rechazo ? (error.status === 409 || error.status === 404 || error.status === 400 ? HttpStatus.CONFLICT : HttpStatus.BAD_GATEWAY) : HttpStatus.SERVICE_UNAVAILABLE,
        'EXTERNAL_RESERVATION_FAILED_COMPENSATED',
        'Reservation could not be completed; payment released',
        rechazo ? `The provider refused the reservation (${error.message}). The payment authorisation was released: you were not charged.` : 'The provider is not available. The payment authorisation was released: you were not charged.',
      );
    }
    await traza.paso('RESERVAR_PROVEEDOR', 'OK', remota.reservationId);

    // The partner's price must be the one the customer agreed to.
    if (remota.estado === 'CANCELLED' || (remota.totalMinor !== null && remota.totalMinor !== totalMinor)) {
      await this.cancelarEnProveedor(producto, remota.reservationId, 'price or status mismatch', reserva.id);
      const anulado = await this.pagos.anular(pago);
      await traza.paso('ANULAR_PAGO', 'COMPENSADO', anulado ? 'anulada' : 'anulación pendiente');
      return fallar('COMPENSADA', 'partner_price_mismatch', HttpStatus.CONFLICT, 'PRICE_CHANGED', 'The price changed', 'The provider confirmed a different price. The payment authorisation was released: you were not charged.');
    }

    // 3. Confirm and invoice here, in one transaction.
    let numeroFactura: string;
    try {
      numeroFactura = await this.dataSource.transaction(async (manager) => {
        await manager.update(ReservaExterna, { id: reserva.id }, { estado: 'CONFIRMADA', externalReservationId: remota.reservationId });
        const factura = await this.facturacion.emitirExterna(manager, { ...reserva, totalMinor } as ReservaExterna, `Experiencia ${producto.nombre} · ${producto.proveedor.nombre}`, this.config.taxRate);
        return factura.numeroFactura;
      });
    } catch (error) {
      this.logger.error(`Local confirmation failed for reservation ${reserva.id}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
      await traza.paso('CONFIRMAR_Y_FACTURAR', 'ERROR', motivoDe(error));
      await this.cancelarEnProveedor(producto, remota.reservationId, 'local confirmation failed', reserva.id);
      const anulado = await this.pagos.anular(pago);
      await traza.paso('ANULAR_PAGO', 'COMPENSADO', anulado ? 'anulada' : 'anulación pendiente');
      return fallar('COMPENSADA', 'confirmation_failed', HttpStatus.BAD_GATEWAY, 'EXTERNAL_RESERVATION_FAILED_COMPENSATED', 'Reservation could not be completed; payment released', 'We could not record your reservation. The payment authorisation was released: you were not charged.');
    }
    await traza.paso('CONFIRMAR_Y_FACTURAR', 'OK', numeroFactura);

    // 4. Capture (retried; parked for the reconciler if the gateway keeps failing).
    await this.pagos.capturar(pago);
    await traza.paso('CAPTURAR_PAGO', 'OK');
    await traza.finalizar('COMPLETADA');
    await this.events
      .publish('ReservaExternaConfirmada', reserva.id, { reservaExternaId: reserva.id, proveedorId: producto.proveedorId, ownerId: auth.ownerId, factura: numeroFactura }, { market: mercado.codigo })
      .catch((e: unknown) => this.logger.error(`Could not announce reservation ${reserva.id}: ${e instanceof Error ? e.message : String(e)}`));

    return { status: HttpStatus.CREATED, body: await this.vista(await this.reservas.findOneByOrFail({ id: reserva.id })) };
  }

  /** Cancels a confirmed reservation: partner first (if it cannot, nothing changes), then the refund and the invoice. */
  async cancelar(auth: AuthClaims, id: string, dto: CancelarReservaExternaDto, key: string): Promise<SagaOutcome & { replayed: boolean }> {
    const { outcome, replayed } = await this.idempotency.executeSaga({ key, route: ROUTE_CANCELAR, ownerId: auth.ownerId, body: { id, ...dto } }, () => this.cancelacion(auth, id, dto));
    return { ...outcome, replayed };
  }

  private async cancelacion(auth: AuthClaims, id: string, dto: CancelarReservaExternaDto): Promise<SagaOutcome> {
    const reserva = await this.propia(auth, id);
    if (reserva.estado === 'CANCELADA') return { status: HttpStatus.OK, body: await this.vista(reserva) };
    if (reserva.estado !== 'CONFIRMADA') {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'INVALID_STATE_TRANSITION', 'Reservation cannot be cancelled', `A reservation in state ${reserva.estado} cannot be cancelled.`);
    }
    const producto = await this.catalogo.findOneOrFail({ where: { id: reserva.catalogoId }, relations: { proveedor: true } });
    if (!producto.cancelacionGratis) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'EXTERNAL_RESERVATION_NOT_REFUNDABLE', 'Not refundable', 'This experience does not allow free cancellation.');
    }
    if (!producto.proveedor.activo) {
      throw new ProblemDetailsException(HttpStatus.SERVICE_UNAVAILABLE, 'PROVIDER_DISABLED', 'Provider is switched off', 'The provider is switched off right now; try again later.');
    }

    const adaptador = this.proveedoresService.adaptador(producto.proveedor.tipoServicio);
    await this.circuitos.ejecutar(producto.proveedorId, () =>
      adaptador.cancelar(producto.proveedor.baseUrl, reserva.externalReservationId!, dto.motivo ?? 'Cancelled by the customer', uuidDe(`cancelacion:${reserva.id}`)),
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.update(ReservaExterna, { id: reserva.id }, { estado: 'CANCELADA', motivo: (dto.motivo ?? 'Cancelled by the customer').slice(0, 300) });
      await manager.update(Factura, { reservaExternaId: reserva.id }, { estado: 'ANULADA' });
    });
    const pago = await this.pagos.autorizadoDeReservaExterna(reserva.id);
    if (pago) await this.pagos.reembolsar(pago, reserva.totalMinor);
    await this.events.publish('ReservaExternaCancelada', reserva.id, { reservaExternaId: reserva.id, proveedorId: reserva.proveedorId, ownerId: reserva.ownerId }, { market: 'ec' }).catch(() => undefined);
    return { status: HttpStatus.OK, body: await this.vista(await this.reservas.findOneByOrFail({ id: reserva.id })) };
  }

  async obtenerPropia(auth: AuthClaims, id: string): Promise<ReservaExternaViewDto> {
    return this.vista(await this.propia(auth, id));
  }

  async listarPropias(auth: AuthClaims): Promise<ReservaExternaViewDto[]> {
    const filas = await this.reservas.find({ where: { ownerId: auth.ownerId }, order: { creadaEn: 'DESC' }, take: 50 });
    return Promise.all(filas.map((f) => this.vista(f)));
  }

  /** Back office: every reservation, newest first. */
  async listarTodas(limite = 50): Promise<ReservaExternaViewDto[]> {
    const filas = await this.reservas.find({ order: { creadaEn: 'DESC' }, take: Math.min(limite, 200) });
    return Promise.all(filas.map((f) => this.vista(f)));
  }

  private async propia(auth: AuthClaims, id: string): Promise<ReservaExterna> {
    const reserva = /^[0-9a-f-]{36}$/i.test(id) ? await this.reservas.findOneBy({ id }) : null;
    // Someone else's reservation answers like a missing one.
    if (!reserva || reserva.ownerId !== auth.ownerId) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Reservation not found', `No reservation ${id}.`);
    return reserva;
  }

  async vista(reserva: ReservaExterna): Promise<ReservaExternaViewDto> {
    const producto = await this.catalogo.findOneOrFail({ where: { id: reserva.catalogoId }, relations: { proveedor: true } });
    const factura = await this.dataSource.getRepository(Factura).findOne({ where: { reservaExternaId: reserva.id } });
    return {
      id: reserva.id,
      estado: reserva.estado,
      experiencia: { id: producto.id, nombre: producto.nombre, proveedor: producto.proveedor.nombre },
      fecha: reserva.fecha,
      hora: reserva.hora,
      cantidad: reserva.cantidad,
      total: money(reserva.totalMinor, reserva.moneda),
      referenciaProveedor: reserva.externalReservationId,
      factura: factura?.numeroFactura ?? null,
      motivo: reserva.motivo,
      creadaEn: reserva.creadaEn.toISOString(),
    };
  }

  /** Best effort: a partner reservation we cannot keep is cancelled; if even that fails it is logged for a person to settle. */
  private async cancelarEnProveedor(producto: CatalogoExterno, reservationId: string, motivo: string, reservaId: string): Promise<void> {
    try {
      const adaptador = this.proveedoresService.adaptador(producto.proveedor.tipoServicio);
      await this.circuitos.ejecutar(producto.proveedorId, () => adaptador.cancelar(producto.proveedor.baseUrl, reservationId, motivo, uuidDe(`cancelacion:${reservaId}`)));
    } catch (error) {
      this.logger.error(`Could not cancel partner reservation ${reservationId} (reservation ${reservaId}): ${error instanceof Error ? error.message : String(error)}. Settle it by hand.`);
    }
  }

  private validarMedio(medios: { tipo: string; marcas: string[]; productos: string[] }[], dto: ReservarExperienciaDto): void {
    const medio = medios.find((m) => m.tipo === dto.medio.tipo && m.productos.includes('ADICIONAL'));
    if (!medio || !medio.marcas.includes(dto.medio.marca)) {
      throw new ProblemDetailsException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYMENT_METHOD_NOT_ALLOWED',
        'Payment method not available in this market',
        `The market accepts: ${medio ? medio.marcas.join(', ') : 'no card brands for experiences'}.`,
        [{ name: 'medio.marca', reason: 'not accepted in this market' }],
      );
    }
  }

  private validarFacturacion(reglas: { tipo: string; etiqueta: string; patron: string }[], dto: ReservarExperienciaDto): void {
    const regla = reglas.find((i) => i.tipo === dto.facturacion.tipoIdentificacion);
    if (!regla) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Tax id type not accepted', `Accepted: ${reglas.map((i) => i.tipo).join(', ')}.`, [{ name: 'facturacion.tipoIdentificacion', reason: 'not accepted in this market' }]);
    }
    if (!new RegExp(`^(?:${regla.patron})$`).test(dto.facturacion.numeroIdentificacion)) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Invalid tax id', `The number does not match ${regla.etiqueta}.`, [{ name: 'facturacion.numeroIdentificacion', reason: `must match ${regla.etiqueta}` }]);
    }
  }
}
