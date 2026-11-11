import { Injectable } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { currentCorrelationId, currentOrigin } from '../../common/correlation';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';

/**
 * Ties every administrative change to the request that made it: the same correlation id the events and sagas of that
 * request carry, and where it came from. It lives here (and not in each writer) so no audit row can be written without
 * them, whichever service writes it.
 */
@Injectable()
export class AuditoriaCambioSubscriber implements EntitySubscriberInterface<AuditoriaCambio> {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo(): typeof AuditoriaCambio {
    return AuditoriaCambio;
  }

  beforeInsert(event: InsertEvent<AuditoriaCambio>): void {
    const entity = event.entity;
    if (!entity) return;
    const correlationId = currentCorrelationId();
    const origin = currentOrigin();
    if (!entity.correlationId && correlationId !== 'no-correlation') entity.correlationId = correlationId.slice(0, 100);
    if (!entity.ip && origin?.ip) entity.ip = origin.ip;
    if (!entity.userAgent && origin?.userAgent) entity.userAgent = origin.userAgent;
  }
}
