import { createHash } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { IdempotencyRecord } from '../entities/idempotency-record.entity';

export interface IdempotencyScope {
  key: string;
  route: string;
  ownerId: string;
  /** The request body (or the parts of it that define the operation). Hashed, never stored. */
  body: unknown;
}

export interface IdempotentResult<T> {
  result: T;
  /** True when the stored response of an earlier identical request was returned. */
  replayed: boolean;
}

/** The business outcome of a saga: a status and body that are stored and replayed verbatim. */
export interface SagaOutcome<T = unknown> {
  status: number;
  body: T;
}

type Identity = Pick<IdempotencyRecord, 'idempotencyKey' | 'route' | 'ownerId'>;

// A claim whose transaction never committed (process crash) is safe to take over after this
// long: completion is written inside the work's own transaction, so an IN_PROGRESS row older
// than any plausible transaction proves the work did not commit.
const STALE_CLAIM_MS = 120_000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalize(v)]),
    );
  }
  return value;
}

export function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(body) ?? null)).digest('hex');
}

const inProgress = () =>
  new ProblemDetailsException(
    HttpStatus.CONFLICT,
    'CONFLICT',
    'Request already in progress',
    'A request with this Idempotency-Key is still being processed. Retry shortly.',
  );

/**
 * RN-18/RF-087. Exactly-once execution of a state-changing request per (key, route, owner):
 *  1. claim the key (INSERT .. ON CONFLICT DO NOTHING), so two parallel retries cannot both run;
 *  2. run the work and mark the claim COMPLETED;
 *  3. on failure drop the claim so the client may retry the same key.
 * A repeat of a completed key returns the stored response; the same key with a different
 * body is rejected rather than replaying someone else's answer.
 *
 * Two flavours: `execute` for work that is one database transaction (completion is written
 * inside it, so a crash can never leave a half-recorded success), and `executeSaga` for
 * multi-step work with external side effects, which records the final business outcome
 * (including business failures such as a declined card) and replays it verbatim.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(IdempotencyRecord) private readonly records: Repository<IdempotencyRecord>,
  ) {}

  async execute<T>(
    scope: IdempotencyScope,
    successStatus: number,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<IdempotentResult<T>> {
    const identity = this.identityOf(scope);
    const replay = await this.claimOrReplay(identity, hashRequestBody(scope.body));
    if (replay) {
      return { result: replay.body as T, replayed: true };
    }

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const value = await work(manager);
        await manager.update(IdempotencyRecord, identity, {
          state: 'COMPLETED',
          responseStatus: successStatus,
          responseBody: value as unknown,
        });
        return value;
      });
      return { result, replayed: false };
    } catch (error) {
      await this.release(identity);
      throw error;
    }
  }

  async executeSaga<T>(
    scope: IdempotencyScope,
    work: () => Promise<SagaOutcome<T>>,
  ): Promise<{ outcome: SagaOutcome<T>; replayed: boolean }> {
    const identity = this.identityOf(scope);
    const replay = await this.claimOrReplay(identity, hashRequestBody(scope.body));
    if (replay) {
      return { outcome: replay as SagaOutcome<T>, replayed: true };
    }

    try {
      const outcome = await work();
      await this.records.update(identity, {
        state: 'COMPLETED',
        responseStatus: outcome.status,
        responseBody: outcome.body as unknown,
      });
      return { outcome, replayed: false };
    } catch (error) {
      // An unexpected failure is not a business outcome: free the key so a retry can resume.
      await this.release(identity);
      throw error;
    }
  }

  /** Housekeeping, called by the periodic sweeper. */
  async purgeExpired(): Promise<number> {
    const result = await this.records.delete({ createdAt: LessThan(new Date(Date.now() - RETENTION_MS)) });
    return result.affected ?? 0;
  }

  private identityOf(scope: IdempotencyScope): Identity {
    return { idempotencyKey: scope.key, route: scope.route, ownerId: scope.ownerId };
  }

  /** Returns the stored response when the key already completed, or null once this caller owns the claim. */
  private async claimOrReplay(identity: Identity, requestHash: string): Promise<SagaOutcome | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await this.claim(identity, requestHash)) {
        return null;
      }

      const existing = await this.records.findOne({ where: identity });
      if (!existing) continue; // released between our insert and our read: claim again

      if (existing.requestHash !== requestHash) {
        throw new ProblemDetailsException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          'Idempotency-Key reused with a different request',
          'This Idempotency-Key was already used with a different payload. Use a new key for a new operation.',
          [{ name: 'Idempotency-Key', reason: 'already used with a different request body' }],
        );
      }
      if (existing.state === 'COMPLETED') {
        return { status: existing.responseStatus ?? HttpStatus.OK, body: existing.responseBody };
      }
      if (Date.now() - existing.createdAt.getTime() > STALE_CLAIM_MS) {
        await this.records.delete({ ...identity, state: 'IN_PROGRESS', createdAt: LessThan(new Date(Date.now() - STALE_CLAIM_MS)) });
        continue;
      }
      throw inProgress();
    }
    throw inProgress();
  }

  private async claim(identity: Identity, requestHash: string): Promise<boolean> {
    const inserted = await this.records
      .createQueryBuilder()
      .insert()
      .values({ ...identity, requestHash, state: 'IN_PROGRESS' })
      .orIgnore()
      .returning('"idempotencyKey"')
      .execute();
    return Array.isArray(inserted.raw) && inserted.raw.length > 0;
  }

  private async release(identity: Identity): Promise<void> {
    await this.records
      .delete({ ...identity, state: 'IN_PROGRESS' })
      .catch((error: unknown) =>
        this.logger.error(`Could not release idempotency claim: ${error instanceof Error ? error.message : String(error)}`),
      );
  }
}
