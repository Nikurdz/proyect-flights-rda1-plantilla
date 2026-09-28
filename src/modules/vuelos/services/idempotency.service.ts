import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyRecord } from '../entities/idempotency-record.entity';

/**
 * RN-18/RF-087: a retried request with the same Idempotency-Key replays the original
 * response instead of re-executing (e.g. double-booking). Scoped per (key, route) since
 * the same key value is only meaningful within one endpoint.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly repository: Repository<IdempotencyRecord>,
  ) {}

  async findReplay<T>(key: string, route: string): Promise<T | undefined> {
    const record = await this.repository.findOne({
      where: { idempotencyKey: key, route },
    });
    return record ? (record.responseBody as T) : undefined;
  }

  async record<T>(key: string, route: string, responseStatus: number, responseBody: T): Promise<void> {
    await this.repository.save(
      this.repository.create({ idempotencyKey: key, route, responseStatus, responseBody }),
    );
  }
}
