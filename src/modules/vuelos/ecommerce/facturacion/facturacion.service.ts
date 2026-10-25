import { randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PASSENGER_TYPES, PassengerType } from '../../common/pricing.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import type { Oferta } from '../ofertas/entities/oferta.entity';
import type { ReservaExterna } from '../integracion/entities/reserva-externa.entity';
import type { Orden } from '../ordenes/entities/orden.entity';
import { FacturaDetalle } from './entities/factura-detalle.entity';
import { Factura } from './entities/factura.entity';

const INVOICE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const TIPO_PASAJERO: Record<PassengerType, string> = { ADULT: 'adulto', YOUTH: 'joven', CHILD: 'niño', INFANT: 'infante' };

/**
 * The tax invoice of an issued order. It is written in the same transaction that issues the order, so an order never
 * exists without its invoice. Each line is one leg for one kind of passenger: the unit price is the fare before tax
 * and the IVA of the line is the tax component of the quote (the platform's TAX_RATE), so subtotal + IVA is exactly
 * what the customer was charged.
 */
@Injectable()
export class FacturacionService {
  async emitir(manager: EntityManager, orden: Orden, oferta: Oferta): Promise<Factura> {
    const cantidades: Record<PassengerType, number> = { ADULT: oferta.adultos, YOUTH: oferta.jovenes, CHILD: oferta.ninos, INFANT: oferta.infantes };

    const detalles: FacturaDetalle[] = [];
    for (const trayecto of oferta.trayectos) {
      for (const tipo of PASSENGER_TYPES) {
        const precio = trayecto.unitarios[tipo];
        const cantidad = cantidades[tipo];
        if (!precio || cantidad === 0) continue;
        const ivaMinor = precio.tasasMinor * cantidad;
        detalles.push(
          manager.create(FacturaDetalle, {
            linea: detalles.length + 1,
            tipo: 'TARIFA',
            concepto: `Vuelo ${trayecto.numeroVuelo} ${trayecto.origen}-${trayecto.destino} · ${TIPO_PASAJERO[tipo]}`,
            cantidad,
            precioUnitarioMinor: precio.baseMinor,
            ivaMinor,
            totalMinor: precio.baseMinor * cantidad + ivaMinor,
          }),
        );
      }
    }

    const subtotalMinor = detalles.reduce((sum, d) => sum + d.precioUnitarioMinor * d.cantidad, 0);
    const ivaMinor = detalles.reduce((sum, d) => sum + d.ivaMinor, 0);
    const totalMinor = subtotalMinor + ivaMinor;
    if (totalMinor !== orden.totalMinor) {
      // The quote and the charge must agree to the cent; if they do not, nothing is issued.
      throw new Error(`Invoice total ${totalMinor} differs from the order total ${orden.totalMinor} (order ${orden.numeroOrden})`);
    }

    return manager.save(
      manager.create(Factura, {
        numeroFactura: await this.nuevoNumero(manager),
        ordenId: orden.ordenId,
        datosFacturacionId: orden.datosFacturacionId,
        moneda: orden.moneda,
        subtotalMinor,
        ivaMinor,
        totalMinor,
        estado: 'EMITIDA',
        detalles,
      }),
    );
  }

  /**
   * Invoice of a partner-product reservation, one line. The partner quotes a final price, so the platform's IVA
   * (TAX_RATE) is taken out of it: subtotal = total / (1 + rate), IVA = the rest. Written in the same transaction
   * that confirms the reservation.
   */
  async emitirExterna(manager: EntityManager, reserva: ReservaExterna, concepto: string, taxRate: number): Promise<Factura> {
    const totalMinor = reserva.totalMinor;
    const subtotalMinor = Math.round(totalMinor / (1 + taxRate));
    const ivaMinor = totalMinor - subtotalMinor;
    const precioUnitarioMinor = Math.round(subtotalMinor / reserva.cantidad);
    return manager.save(
      manager.create(Factura, {
        numeroFactura: await this.nuevoNumero(manager),
        ordenId: null,
        reservaExternaId: reserva.id,
        datosFacturacionId: reserva.datosFacturacionId,
        moneda: reserva.moneda,
        subtotalMinor,
        ivaMinor,
        totalMinor,
        estado: 'EMITIDA',
        detalles: [
          manager.create(FacturaDetalle, { linea: 1, tipo: 'EXPERIENCIA', concepto: concepto.slice(0, 200), cantidad: reserva.cantidad, precioUnitarioMinor, ivaMinor, totalMinor }),
        ],
      }),
    );
  }

  private async nuevoNumero(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let suffix = '';
      for (let i = 0; i < 10; i++) suffix += INVOICE_ALPHABET[randomInt(INVOICE_ALPHABET.length)];
      const numeroFactura = `FAC-${suffix}`;
      if (!(await manager.exists(Factura, { where: { numeroFactura } }))) return numeroFactura;
    }
    throw new ProblemDetailsException(HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', 'Could not allocate an invoice number', 'Please try again.');
  }
}
