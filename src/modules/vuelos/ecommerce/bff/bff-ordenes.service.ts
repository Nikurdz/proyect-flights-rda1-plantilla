import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthClaims } from '../../auth/token.service';
import { toIso } from '../../common/date.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import { enmascararCorreo, enmascararTelefono } from '../common/enmascarar';
import { Factura } from '../facturacion/entities/factura.entity';
import { HistorialOrdenesQueryDto, OrdenViewDto } from '../ordenes/dto/ordenes.dto';
import { Orden, TRANSICIONES } from '../ordenes/entities/orden.entity';
import { OrdenesService } from '../ordenes/ordenes.service';
import { AuditoriaSaga, AuditoriaSagaPaso, AuditoriaTransaccion } from '../observabilidad/entities/auditoria.entity';
import { Pago } from '../pagos/entities/pago.entity';
import { AccionOrden, accionesOrden } from './acciones';
import type { ExpedienteOrdenDto, FacturaResumenDto, MovilOrdenDto, MovilOrdenesPaginaDto, WebOrdenDto } from './dto/bff.dto';
import { aMovil, aMovilResumen, importesDe } from './mapeos';

/** The audit trail shown in the back-office file is a window, not the whole history. */
const MAX_EVENTOS = 50;

/**
 * The per-client views of an order (mobile, web, back office). Read-only: it composes what the order, invoice,
 * payment and audit tables already hold, with one query per table, and never writes, publishes events or decides a
 * business rule. Ownership comes from the order service (someone else's order is a 404) and the back-office route
 * is guarded by the ADMIN role in its controller.
 */
@Injectable()
export class BffOrdenesService {
  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    private readonly ordenesService: OrdenesService,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  // ---- Mobile ----

  async movilListado(auth: AuthClaims, query: HistorialOrdenesQueryDto): Promise<MovilOrdenesPaginaDto> {
    const pagina = await this.ordenesService.historial(auth, 'me', query);
    return { items: pagina.items.map(aMovilResumen), ...(pagina.nextCursor ? { next: pagina.nextCursor } : {}) };
  }

  async movilDetalle(auth: AuthClaims, numero: string): Promise<MovilOrdenDto> {
    const vista = await this.ordenesService.obtenerPropia(auth, numero);
    return aMovil(vista, this.acciones(vista));
  }

  // ---- Web (the customer) ----

  async webDetalle(auth: AuthClaims, numero: string): Promise<WebOrdenDto> {
    const orden = await this.ordenesService.ordenPropia(auth, numero);
    const vista = await this.ordenesService.vista(orden, { conEstadoVuelo: true });
    const factura = await this.facturaDe(orden.ordenId);
    return {
      ...vista,
      importes: importesDe({ moneda: orden.moneda, totalMinor: orden.totalMinor, factura }),
      ...(factura ? { factura: this.resumenFactura(factura) } : {}),
      acciones: this.acciones(vista),
    };
  }

  // ---- Back office (ADMIN) ----

  async expediente(numeroOrden: string): Promise<ExpedienteOrdenDto> {
    const orden = await this.ordenes.findOne({ where: { numeroOrden } });
    if (!orden) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found', `No order ${numeroOrden}.`);

    const manager = this.ordenes.manager;
    const vista = await this.ordenesService.vista(orden, { conEstadoVuelo: true });
    const [factura, pagos, sagas] = await Promise.all([
      this.facturaDe(orden.ordenId),
      manager.find(Pago, { where: { ordenId: orden.ordenId } }),
      // The purchase saga is recorded against the offer, not the order.
      manager.find(AuditoriaSaga, { where: { referencia: orden.ofertaId }, order: { iniciadaEn: 'ASC' } }),
    ]);
    const pago = pagos[0];
    const agregados = [orden.ordenId, orden.ofertaId, ...(orden.bookingId ? [orden.bookingId] : []), ...pagos.map((p) => p.pagoId)];
    const [pasos, eventos] = await Promise.all([
      sagas.length ? manager.find(AuditoriaSagaPaso, { where: { sagaId: In(sagas.map((s) => s.sagaId)) }, order: { secuencia: 'ASC' } }) : Promise.resolve([] as AuditoriaSagaPaso[]),
      manager.find(AuditoriaTransaccion, { where: { agregadoId: In(agregados) }, order: { ocurridoEn: 'ASC' }, take: MAX_EVENTOS }),
    ]);

    return {
      ...vista,
      // Contact is personal data: the back office sees it masked and there is no route to reveal it.
      contacto: { correo: enmascararCorreo(orden.contactoCorreo), telefono: enmascararTelefono(orden.contactoTelefono) },
      ofertaId: orden.ofertaId,
      clienteId: orden.clienteId,
      comprador: orden.clienteId ? 'cliente' : 'invitado',
      canal: orden.canal,
      pago: { ...vista.pago, ...(pago ? { estado: pago.estado, referencia: pago.autorizacionRef } : {}) },
      importes: importesDe({ moneda: orden.moneda, totalMinor: orden.totalMinor, factura }),
      ...(factura ? { factura: this.resumenFactura(factura) } : {}),
      transicionesPosibles: [...TRANSICIONES[orden.estado]],
      auditoria: {
        sagas: sagas.map((s) => ({
          sagaId: s.sagaId,
          tipo: s.tipo,
          estado: s.estado,
          correlationId: s.correlationId,
          error: s.error,
          iniciadaEn: toIso(s.iniciadaEn),
          finalizadaEn: s.finalizadaEn ? toIso(s.finalizadaEn) : null,
          pasos: pasos.filter((p) => p.sagaId === s.sagaId).map((p) => ({ secuencia: p.secuencia, nombre: p.nombre, estado: p.estado, detalle: p.detalle, duracionMs: p.duracionMs })),
        })),
        eventos: eventos.map((e) => ({ tipo: e.tipo, agregadoId: e.agregadoId, correlationId: e.correlationId, resumen: e.resumen, ocurridoEn: toIso(e.ocurridoEn) })),
      },
    };
  }

  // ---- Shared ----

  private acciones(vista: OrdenViewDto): AccionOrden[] {
    return accionesOrden({
      estado: vista.estado as Orden['estado'],
      bookingId: vista.bookingId,
      salidas: vista.itinerarios.map((t) => new Date(t.salida)),
      ahora: new Date(),
      reglas: this.config.postSale,
    });
  }

  private facturaDe(ordenId: string): Promise<Factura | null> {
    return this.ordenes.manager.findOne(Factura, { where: { ordenId, estado: 'EMITIDA' } });
  }

  private resumenFactura(factura: Factura): FacturaResumenDto {
    return { numero: factura.numeroFactura, emitidaEn: toIso(factura.emitidaEn), estado: factura.estado };
  }
}
