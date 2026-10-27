import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { CloudEvent, isVuelosEventName, toCloudEvent } from '../common/cloud-events';
import { DomainEvent, DomainEventBus } from '../common/domain-event-bus';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { EventsQueryDto } from './dto-v2';

export const cursorOf = (seq: string): string => `evt-vue-${seq.padStart(6, '0')}`;

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

  /** `after` is the cursor of the last event read (`evt-vue-000120`) or its event id. */
  async list(query: EventsQueryDto): Promise<{ events: CloudEvent[]; metadata: { total: number; next_after: string | null; timestamp: string } }> {
    const limit = query.limit ?? 20;
    let afterSeq = '0';
    if (query.after) {
      const match = /^evt-vue-(\d+)$/.exec(query.after);
      if (match) afterSeq = String(Number(match[1]));
      else if (/^[0-9a-f-]{36}$/i.test(query.after)) {
        const row = await this.outbox.findOne({ where: { eventoId: query.after } });
        if (row) afterSeq = row.seq;
      }
    }
    const rows = await this.outbox.find({
      where: { seq: MoreThan(afterSeq), ...(query.type ? { type: query.type } : {}) },
      order: { seq: 'ASC' },
      take: limit,
    });
    return {
      events: rows.map((r) => r.cloudEvent as unknown as CloudEvent),
      metadata: { total: rows.length, next_after: rows.length ? cursorOf(rows[rows.length - 1].seq) : (query.after ?? null), timestamp: new Date().toISOString() },
    };
  }
}
