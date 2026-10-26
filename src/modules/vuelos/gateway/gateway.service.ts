import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import type { AuthClaims } from '../auth/token.service';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { toIso } from '../common/date.util';
import { CheckInService } from '../services/check-in.service';
import { SearchService } from '../services/search.service';
import { money } from '../ecommerce/common/moneda.util';
import { Factura } from '../ecommerce/facturacion/entities/factura.entity';
import { CancelarReservaExternaDto, ExperienciasQueryDto, ReservarExperienciaDto } from '../ecommerce/integracion/dto/integracion.dto';
import { ExperienciasService } from '../ecommerce/integracion/experiencias.service';
import { ProveedoresService } from '../ecommerce/integracion/proveedores.service';
import { ReservasExternasService } from '../ecommerce/integracion/reservas-externas.service';
import { ReservaExterna } from '../ecommerce/integracion/entities/reserva-externa.entity';
import { AuditoriaSaga, AuditoriaTransaccion } from '../ecommerce/observabilidad/entities/auditoria.entity';
import { Orden } from '../ecommerce/ordenes/entities/orden.entity';
import { OrdenesService } from '../ecommerce/ordenes/ordenes.service';
import { EsbRouter } from '../esb/esb-router';
import {
  AuditoriaSagaGql,
  AuditoriaTransaccionGql,
  CatalogoUnificadoGql,
  CheckInGql,
  FacturaGql,
  MisReservasGql,
  ReservarExperienciaInputGql,
  SaludNodoGql,
} from './gateway.types';

export const RUTAS = {
  catalogo: 'catalogo.unificado',
  misReservas: 'reservas.mias',
  factura: 'facturacion.factura',
  salud: 'integracion.salud',
  transacciones: 'auditoria.transacciones',
  sagas: 'auditoria.sagas',
  reservar: 'experiencias.reservar',
  cancelar: 'experiencias.cancelar',
  checkIn: 'checkin.digital',
} as const;

const exigir = (auth: AuthClaims | null): AuthClaims => {
  if (!auth) throw new ProblemDetailsException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Authentication required', 'Send a Bearer access token.');
  return auth;
};
const exigirAdmin = (auth: AuthClaims | null): AuthClaims => {
  const a = exigir(auth);
  if (!a.roles.includes('ADMIN')) throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Administrator required', 'This operation is for administrators.');
  return a;
};

export function facturaGql(f: Factura): FacturaGql {
  const m = (v: number) => money(v, f.moneda);
  return {
    numeroFactura: f.numeroFactura,
    estado: f.estado,
    emitidaEn: toIso(f.emitidaEn),
    subtotal: m(f.subtotalMinor),
    iva: m(f.ivaMinor),
    total: m(f.totalMinor),
    ordenId: f.ordenId,
    reservaExternaId: f.reservaExternaId,
    detalles: [...(f.detalles ?? [])].sort((a, b) => a.linea - b.linea).map((d) => ({ linea: d.linea, tipo: d.tipo, concepto: d.concepto, cantidad: d.cantidad, precioUnitario: m(d.precioUnitarioMinor), iva: m(d.ivaMinor), total: m(d.totalMinor) })),
  };
}

/** Validates a GraphQL input with the REST DTO's own rules, so both doors accept exactly the same data. */
async function validarComo<T extends object>(clase: new () => T, entrada: unknown): Promise<T> {
  const dto = plainToInstance(clase, entrada);
  const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errores.length > 0) {
    const detalle = errores.flatMap((e) => Object.values(e.constraints ?? { [e.property]: 'invalid' })).join('; ');
    throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid input', detalle);
  }
  return dto;
}

/** The operations the gateway offers, registered on the ESB router: the gateway asks the bus, the bus runs these. */
@Injectable()
export class GatewayService implements OnModuleInit {
  constructor(
    private readonly esb: EsbRouter,
    private readonly search: SearchService,
    private readonly experiencias: ExperienciasService,
    private readonly proveedores: ProveedoresService,
    private readonly reservas: ReservasExternasService,
    private readonly ordenes: OrdenesService,
    private readonly checkInService: CheckInService,
    @InjectRepository(Factura) private readonly facturas: Repository<Factura>,
    @InjectRepository(Orden) private readonly ordenesRepo: Repository<Orden>,
    @InjectRepository(ReservaExterna) private readonly reservasRepo: Repository<ReservaExterna>,
    @InjectRepository(AuditoriaTransaccion) private readonly transacciones: Repository<AuditoriaTransaccion>,
    @InjectRepository(AuditoriaSaga) private readonly sagas: Repository<AuditoriaSaga>,
  ) {}

  onModuleInit(): void {
    this.esb.registrar(RUTAS.catalogo, (e: { origen?: string; destino?: string; fecha?: string; q?: string; limite?: number }) => this.catalogoUnificado(e));
    this.esb.registrar(RUTAS.misReservas, (_e: void, auth) => this.misReservas(exigir(auth)));
    this.esb.registrar(RUTAS.factura, (e: { numeroFactura: string }, auth) => this.facturaCompleta(exigir(auth), e.numeroFactura));
    this.esb.registrar(RUTAS.salud, (_e: void, auth) => this.saludNodos(exigirAdmin(auth)));
    this.esb.registrar(RUTAS.transacciones, (e: { correlationId?: string; tipo?: string; limite?: number }, auth) => this.auditoriaTransacciones(exigirAdmin(auth), e));
    this.esb.registrar(RUTAS.sagas, (e: { correlationId?: string; tipo?: string; estado?: string; limite?: number }, auth) => this.auditoriaSagas(exigirAdmin(auth), e));
    this.esb.registrar(RUTAS.reservar, (e: { experienciaId: string; input: ReservarExperienciaInputGql; idempotencyKey: string }, auth) => this.reservar(exigir(auth), e));
    this.esb.registrar(RUTAS.cancelar, (e: { reservaId: string; motivo?: string; idempotencyKey: string }, auth) => this.cancelar(exigir(auth), e));
    this.esb.registrar(RUTAS.checkIn, (e: { bookingId: string }, auth) => this.checkIn(exigir(auth), e.bookingId));
  }

  async catalogoUnificado(e: { origen?: string; destino?: string; fecha?: string; q?: string; limite?: number }): Promise<CatalogoUnificadoGql> {
    const limite = Math.min(Math.max(e.limite ?? 12, 1), 50);
    const experiencias = (await this.experiencias.listar(Object.assign(new ExperienciasQueryDto(), { q: e.q, limite, desde: 0 }))).items;
    let vuelos: CatalogoUnificadoGql['vuelos'] = [];
    if (e.fecha) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha)) throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid date', 'fecha must be YYYY-MM-DD.');
      const encontrados = await this.search.findDirectFlights(e.origen?.toUpperCase(), e.destino?.toUpperCase(), e.fecha, 1, { includeSoldOut: true });
      vuelos = encontrados.slice(0, limite).map((v) => ({
        id: v.id,
        codigoVuelo: v.codigoVuelo,
        aerolinea: v.aerolinea,
        origen: v.origenIATA,
        destino: v.destinoIATA,
        salida: toIso(v.fechaSalida),
        llegada: toIso(v.fechaLlegada),
        asientosDisponibles: v.asientosDisponibles,
        precioBaseUsd: v.precioBase,
      }));
    }
    return { vuelos, experiencias };
  }

  async misReservas(auth: AuthClaims): Promise<MisReservasGql> {
    // Guests have no history of orders (they recover a trip with the number and surname); their experiences are theirs.
    const ordenes = auth.kind === 'customer' ? (await this.ordenes.historial(auth, 'me', { limit: 20 })).items : [];
    const experiencias = await this.reservas.listarPropias(auth);
    return {
      ordenes: ordenes.map((o) => ({
        ordenId: o.ordenId,
        numeroOrden: o.numeroOrden,
        pnr: o.pnr,
        estado: o.estado,
        total: o.total,
        creadaEn: o.creadaEn,
        itinerarios: o.itinerarios.map((i) => ({ numeroVuelo: i.numeroVuelo, origen: i.origen, destino: i.destino, salida: i.salida, llegada: i.llegada })),
      })),
      experiencias: experiencias.map((r) => ({
        id: r.id,
        estado: r.estado,
        experienciaId: r.experiencia.id,
        experiencia: r.experiencia.nombre,
        proveedor: r.experiencia.proveedor,
        fecha: r.fecha,
        hora: r.hora,
        cantidad: r.cantidad,
        total: r.total,
        referenciaProveedor: r.referenciaProveedor,
        motivo: r.motivo,
        creadaEn: r.creadaEn,
      })),
    };
  }

  /** An invoice is for its buyer (and the administrators): anyone else gets the same "not found". */
  async facturaCompleta(auth: AuthClaims, numeroFactura: string): Promise<FacturaGql> {
    const factura = await this.facturas.findOne({ where: { numeroFactura }, relations: { detalles: true } });
    const duenio = factura
      ? factura.ordenId
        ? (await this.ordenesRepo.findOne({ where: { ordenId: factura.ordenId }, select: { ownerId: true } }))?.ownerId
        : (await this.reservasRepo.findOne({ where: { id: factura.reservaExternaId }, select: { ownerId: true } }))?.ownerId
      : undefined;
    if (!factura || (duenio !== auth.ownerId && !auth.roles.includes('ADMIN'))) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Invoice not found', `No invoice ${numeroFactura}.`);
    }
    return facturaGql(factura);
  }

  async saludNodos(_auth: AuthClaims): Promise<SaludNodoGql[]> {
    return (await this.proveedores.listar()).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      equipo: p.equipo,
      tipoServicio: p.tipoServicio,
      activo: p.activo,
      estado: p.salud.estado,
      latenciaMs: p.salud.latenciaMs,
      detalle: p.salud.detalle,
      comprobadoEn: p.salud.comprobadoEn ? p.salud.comprobadoEn.toISOString() : null,
      circuito: p.circuito,
      productos: p.productos,
    }));
  }

  async auditoriaTransacciones(_auth: AuthClaims, e: { correlationId?: string; tipo?: string; limite?: number }): Promise<AuditoriaTransaccionGql[]> {
    const filas = await this.transacciones.find({
      where: { ...(e.correlationId ? { correlationId: e.correlationId } : {}), ...(e.tipo ? { tipo: e.tipo } : {}) },
      order: { ocurridoEn: 'DESC' },
      take: Math.min(Math.max(e.limite ?? 50, 1), 200),
    });
    return filas.map((f) => ({ id: f.id, eventoId: f.eventoId, tipo: f.tipo, agregadoId: f.agregadoId, propietarioId: f.propietarioId, correlationId: f.correlationId, resumen: f.resumen, ocurridoEn: toIso(f.ocurridoEn) }));
  }

  async auditoriaSagas(_auth: AuthClaims, e: { correlationId?: string; tipo?: string; estado?: string; limite?: number }): Promise<AuditoriaSagaGql[]> {
    const filas = await this.sagas.find({
      where: { ...(e.correlationId ? { correlationId: e.correlationId } : {}), ...(e.tipo ? { tipo: e.tipo } : {}), ...(e.estado ? { estado: e.estado as AuditoriaSaga['estado'] } : {}) },
      relations: { pasos: true },
      order: { iniciadaEn: 'DESC' },
      take: Math.min(Math.max(e.limite ?? 30, 1), 100),
    });
    return filas.map((s) => ({
      sagaId: s.sagaId,
      tipo: s.tipo,
      referencia: s.referencia,
      correlationId: s.correlationId,
      estado: s.estado,
      error: s.error,
      iniciadaEn: toIso(s.iniciadaEn),
      finalizadaEn: s.finalizadaEn ? toIso(s.finalizadaEn) : null,
      pasos: [...(s.pasos ?? [])].sort((a, b) => a.secuencia - b.secuencia).map((p) => ({ secuencia: p.secuencia, nombre: p.nombre, estado: p.estado, detalle: p.detalle, duracionMs: p.duracionMs })),
    }));
  }

  /** The same saga as the REST route; a business failure (declined card, partner refused…) comes back as an error with its code. */
  async reservar(auth: AuthClaims, e: { experienciaId: string; input: ReservarExperienciaInputGql; idempotencyKey: string }) {
    const dto = await validarComo(ReservarExperienciaDto, e.input);
    const resultado = await this.reservas.reservar(auth, e.experienciaId, dto, e.idempotencyKey);
    if (resultado.status >= 400) {
      const problema = resultado.body as { status: number; code: never; title: string; detail?: string };
      throw new ProblemDetailsException(problema.status, problema.code, problema.title, problema.detail ?? '');
    }
    return resultado.body;
  }

  async cancelar(auth: AuthClaims, e: { reservaId: string; motivo?: string; idempotencyKey: string }) {
    const dto = await validarComo(CancelarReservaExternaDto, { motivo: e.motivo });
    return (await this.reservas.cancelar(auth, e.reservaId, dto, e.idempotencyKey)).body;
  }

  async checkIn(auth: AuthClaims, bookingId: string): Promise<CheckInGql> {
    const r = await this.checkInService.checkIn(auth, bookingId);
    return { bookingId: r.bookingId, estado: r.status, pasajeros: r.checkedInPassengers.map((p) => ({ passengerId: p.passengerId, estado: p.status })) };
  }
}
