import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthClaims } from '../../auth/token.service';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { WebhookDelivery } from '../../entities/webhook-delivery.entity';
import { WebhookSubscription } from '../../entities/webhook-subscription.entity';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';
import { WebhookEntregasQueryDto } from './webhooks-admin.dto';

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

/** What a delivery is about, read from its stored body (a v2 CloudEvent names it in `subject`/`data`, a v1 one at the top). */
function referenciaDe(payload: Record<string, unknown>): { bookingId: string | null; pnr: string | null; partnerOrderId: string | null } {
  const data = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  return { bookingId: str(data.bookingId), pnr: str(data.pnr), partnerOrderId: str(data.partnerOrderId) };
}

/**
 * Webhooks as the airline sees them (ADMIN): every subscription of every owner and every delivery with its attempts,
 * so a partner session (Booking) can check that each confirmation, check-in and cancellation reached it. The secret is
 * never returned. Retrying only puts a delivery back in the queue; the dispatcher sends it with the same signed body.
 */
@Injectable()
export class WebhooksAdminService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async suscripciones() {
    const rows = await this.dataSource.manager.find(WebhookSubscription, { relations: { eventos: true }, order: { createdAt: 'DESC' } });
    const counts = await this.dataSource.manager
      .createQueryBuilder(WebhookDelivery, 'd')
      .select('d.subscriptionId', 'subscriptionId')
      .addSelect('d.status', 'status')
      .addSelect('COUNT(*)', 'n')
      .groupBy('d.subscriptionId')
      .addGroupBy('d.status')
      .getRawMany<{ subscriptionId: string; status: string; n: string }>();
    const countOf = (id: string, status: string) => Number(counts.find((c) => c.subscriptionId === id && c.status === status)?.n ?? 0);
    return {
      items: rows.map((s) => ({
        suscripcionId: s.id,
        owner: s.ownerId,
        url: s.url,
        eventos: s.events,
        activa: s.active,
        apiVersion: s.apiVersion ?? 1,
        creadaEn: iso(s.createdAt),
        entregas: { pendientes: countOf(s.id, 'PENDING'), entregadas: countOf(s.id, 'DELIVERED'), muertas: countOf(s.id, 'DEAD') },
      })),
    };
  }

  async entregas(query: WebhookEntregasQueryDto) {
    const limite = query.limite ?? 20;
    const pagina = query.pagina ?? 1;
    const qb = this.dataSource.manager.createQueryBuilder(WebhookDelivery, 'd').innerJoinAndSelect('d.subscription', 's');
    if (query.estado) qb.andWhere('d.status = :estado', { estado: query.estado });
    if (query.tipo) qb.andWhere('d.eventType = :tipo', { tipo: query.tipo });
    if (query.owner) qb.andWhere('s.ownerId = :owner', { owner: query.owner });
    if (query.suscripcionId) qb.andWhere('d.subscriptionId = :sid', { sid: query.suscripcionId });
    const [rows, total] = await qb
      .orderBy('d.createdAt', 'DESC')
      .addOrderBy('d.deliveryId', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite)
      .getManyAndCount();
    return {
      items: rows.map((d) => ({
        deliveryId: d.deliveryId,
        suscripcionId: d.subscriptionId,
        owner: d.subscription?.ownerId ?? null,
        url: d.subscription?.url ?? null,
        eventId: d.eventId,
        tipo: d.eventType,
        estado: d.status,
        intentos: d.attempts,
        proximoIntento: d.status === 'PENDING' ? iso(d.nextAttemptAt) : null,
        ultimoCodigo: d.lastStatusCode,
        ultimoError: d.lastError,
        creadaEn: iso(d.createdAt),
        entregadaEn: iso(d.deliveredAt),
        ...referenciaDe(d.payload),
      })),
      total,
      pagina,
      limite,
    };
  }

  /** A DEAD (or still pending) delivery goes back to the queue with a fresh retry schedule; a delivered one is final. */
  async reintentar(auth: AuthClaims, deliveryId: string) {
    const manager = this.dataSource.manager;
    const delivery = await manager.findOneBy(WebhookDelivery, { deliveryId });
    if (!delivery) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Entrega no encontrada', `No existe la entrega ${deliveryId}.`);
    if (delivery.status === 'DELIVERED') {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CONFLICT', 'Entrega ya realizada', 'El receptor ya confirmó esta entrega; no se reenvía.');
    }
    const antes = { estado: delivery.status, intentos: delivery.attempts };
    await manager.update(WebhookDelivery, { deliveryId }, { status: 'PENDING', attempts: 0, nextAttemptAt: new Date() });
    await manager.save(
      manager.create(AuditoriaCambio, { entidad: 'webhook_entrega', entidadId: deliveryId, actorId: auth.ownerId, accion: 'REINTENTAR_WEBHOOK', antes, despues: { estado: 'PENDING', intentos: 0 } }),
    );
    return { deliveryId, estado: 'PENDING' as const, mensaje: 'En cola: el despachador la envía en su próxima vuelta (cada 15 s).' };
  }
}
