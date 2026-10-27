import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { PromocionAlcance, PromocionContrato } from '../entities/promocion-contrato.entity';
import { PromocionesContratoRequestDto } from './dto-v2';

/** The single B2B agreement with Booking Prototipo. */
const BOOKING_PARTNER = 'booking-prototipo';

/**
 * GET/PUT /promociones/contrato (contract v2): the airline's answer to "do you take part in combos, up to what
 * discount, on which routes, destinations and cabins". `assertDiscountAllowed` is what a booking that says it applied a
 * promotion is checked against.
 */
@Injectable()
export class PromotionsV2Service {
  constructor(
    @InjectRepository(PromocionContrato) private readonly contracts: Repository<PromocionContrato>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  async get() {
    const contract = await this.contracts.findOne({ where: { id: BOOKING_PARTNER }, relations: { alcances: true } });
    if (!contract) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Sin acuerdo de promociones', 'La aerolínea todavía no registró su acuerdo de promociones.');
    }
    return this.view(contract);
  }

  async put(request: PromocionesContratoRequestDto) {
    if (!request.permite_promociones && request.porcentaje_descuento_maximo > 0) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'PROMOTION_DISCOUNT_OUT_OF_RANGE', 'Descuento incompatible', 'Si no se permiten promociones, el descuento máximo debe ser 0.', [
        { name: 'porcentaje_descuento_maximo', reason: 'must be 0 when permite_promociones is false' },
      ]);
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(PromocionAlcance, { contratoId: BOOKING_PARTNER });
      await manager.save(
        manager.create(PromocionContrato, {
          id: BOOKING_PARTNER,
          permitePromociones: request.permite_promociones,
          porcentajeDescuentoMaximo: request.porcentaje_descuento_maximo,
          vigenciaHasta: request.vigencia_hasta ?? null,
          condicionesCombo: request.condiciones_combo ?? null,
          alcances: [
            ...(request.destinos_habilitados ?? []).map((valor) => manager.create(PromocionAlcance, { contratoId: BOOKING_PARTNER, tipo: 'DESTINO', valor })),
            ...(request.rutas_habilitadas ?? []).map((valor) => manager.create(PromocionAlcance, { contratoId: BOOKING_PARTNER, tipo: 'RUTA', valor })),
            ...(request.cabinas_habilitadas ?? []).map((valor) => manager.create(PromocionAlcance, { contratoId: BOOKING_PARTNER, tipo: 'CABINA', valor })),
          ],
        }),
      );
    });
    return this.get();
  }

  /** A sale that claims a promotion must stay inside the agreement. */
  async assertDiscountAllowed(discountPercentage: number | undefined): Promise<void> {
    const contract = await this.contracts.findOne({ where: { id: BOOKING_PARTNER } });
    const discount = discountPercentage ?? 0;
    const today = new Date().toISOString().slice(0, 10);
    if (!contract || !contract.permitePromociones || discount > contract.porcentajeDescuentoMaximo || (contract.vigenciaHasta && contract.vigenciaHasta < today)) {
      throw new ProblemDetailsException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PROMOTION_DISCOUNT_OUT_OF_RANGE',
        'Descuento fuera del acuerdo',
        contract?.permitePromociones ? `El descuento ${discount}% supera el máximo autorizado (${contract.porcentajeDescuentoMaximo}%) o el acuerdo venció.` : 'La aerolínea no tiene un acuerdo de promociones vigente.',
        [{ name: 'salesChannel.discountPercentage', reason: 'outside the promotions agreement' }],
      );
    }
  }

  private view(contract: PromocionContrato) {
    const scope = (tipo: string) => (contract.alcances ?? []).filter((a) => a.tipo === tipo).map((a) => a.valor).sort();
    return {
      proveedor_codigo: this.config.nodeId,
      nombre_socio: 'Booking Prototipo',
      vertical: 'VUELOS',
      actualizado_en: contract.actualizadoEn.toISOString(),
      permite_promociones: contract.permitePromociones,
      porcentaje_descuento_maximo: contract.porcentajeDescuentoMaximo,
      destinos_habilitados: scope('DESTINO'),
      rutas_habilitadas: scope('RUTA'),
      cabinas_habilitadas: scope('CABINA'),
      ...(contract.vigenciaHasta ? { vigencia_hasta: contract.vigenciaHasta } : {}),
      ...(contract.condicionesCombo ? { condiciones_combo: contract.condicionesCombo } : {}),
    };
  }
}
