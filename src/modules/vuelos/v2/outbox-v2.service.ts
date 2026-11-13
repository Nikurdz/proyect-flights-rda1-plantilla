import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CloudEvent, isVuelosEventName, toCloudEvent } from '../common/cloud-events';
import { DomainEvent, DomainEventBus } from '../common/domain-event-bus';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { EventsQueryDto } from './dto-v2';
import { runsDomain } from '../common/service-role';

/** A cursor that is neither `evt-vue-<n>` nor a known event id: refused, never silently restarted from the beginning. */
const unknownCursor = (after: string): ProblemDetailsException =>
  new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Cursor desconocido', `El cursor "${after}" no corresponde a ningún evento; use metadata.next_after de la respuesta anterior.`, [{ name: 'after', reason: 'unknown cursor' }]);

/**
 * The event feed (GET /eventos): every contract event is kept in order as the CloudEvent subscribers receive, so a
 * partner that missed a webhook can catch up. It is written when the event is announced (after the operation
 * committed), not inside that transaction; announcing the same event twice stores it once.
 */
@Injectable()
export class OutboxV2Service implements OnModuleInit {
  constructor(
    @InjectRepository(OutboxEvent) private readonly outbox: Repository<OutboxEvent>,
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  onModuleInit(): void {
    if (!runsDomain('webhooks')) return;
    this.events.subscribeAll((event) => this.record(event));
  }

  async record(event: DomainEvent): Promise<void> {
    if (!isVuelosEventName(event.type)) return;
    const cloudEvent = toCloudEvent(event, this.config.nodeSource);
    if (!cloudEvent) return;
    await this.outbox
      .createQueryBuilder()
      .insert()
      .values({ eventoId: event.id, type: event.type, subject: event.aggregateId, correlationId: event.correlationId, occurredAt: new Date(event.occurredAt), cloudEvent: cloudEvent as unknown as Record<string, unknown> })
      .orIgnore()
      .execute();
  }

  /** `after` is the id of the last event read (what `metadata.next_after` returns) or its older cursor form (`evt-vue-000120`). */
  async list(query: EventsQueryDto): Promise<{ events: CloudEvent[]; metadata: { total: number; next_after: string | null; timestamp: string } }> {
    const limit = query.limit ?? 20;
    const qb = this.outbox.createQueryBuilder('e');
    // Only events that have been in the table for a moment: two inserts can commit out of `seq` order, and a partner that
    // already read the later one would never see the earlier one. A recent row waits until the next poll.
    qb.where('e."createdAt" <= NOW() - (:delayMs::int * INTERVAL \'1 millisecond\')', { delayMs: this.config.outboxFeedDelayMs });
    let cursorId: string | undefined;
    if (query.after) {
      const match = /^evt-vue-(\d+)$/.exec(query.after);
      if (match) qb.andWhere('e.seq > :afterSeq', { afterSeq: String(Number(match[1])) });
      else if (/^[0-9a-f-]{36}$/i.test(query.after)) {
        // The cursor is resolved inside the same statement (the table name comes from the metadata, so it works in any schema).
        const cursorSeq = qb.subQuery().select('c.seq').from(OutboxEvent, 'c').where('c."eventoId" = :cursorId').getQuery();
        qb.andWhere(`e.seq > ${cursorSeq}`, { cursorId: query.after });
        cursorId = query.after;
      } else {
        throw unknownCursor(query.after);
      }
    }
    if (query.type) qb.andWhere('e.type = :type', { type: query.type });
    const rows = await qb.orderBy('e.seq', 'ASC').take(limit).getMany();
    // An unknown cursor matches nothing: only an empty page needs the second query that tells it from "nothing new yet".
    if (rows.length === 0 && cursorId && !(await this.outbox.exists({ where: { eventoId: cursorId } }))) throw unknownCursor(cursorId);
    return {
      events: rows.map((r) => r.cloudEvent as unknown as CloudEvent),
      // The id of the last event read, which is what a partner keeps as its cursor (the `evt-vue-<n>` form is still accepted in `after`).
      metadata: { total: rows.length, next_after: rows.length ? rows[rows.length - 1].eventoId : (query.after ?? null), timestamp: new Date().toISOString() },
    };
  }
}
