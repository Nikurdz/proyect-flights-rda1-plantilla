import { HttpStatus } from '@nestjs/common';
import { toIso } from './date.util';
import { ProblemDetailsException } from './problem-details.exception';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opaque keyset cursor over (createdAt, id): stable under concurrent inserts, unlike OFFSET. */
export function encodeCursor(createdAt: Date | string, id: string): string {
  return Buffer.from(JSON.stringify({ c: toIso(createdAt), i: id })).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as { c?: string; i?: string };
    const createdAt = new Date(parsed.c ?? '');
    if (Number.isNaN(createdAt.getTime()) || !parsed.i || !UUID.test(parsed.i)) throw new Error('bad cursor');
    return { createdAt, id: parsed.i };
  } catch {
    throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid cursor', 'The cursor is malformed or was not issued by this API.', [
      { name: 'cursor', reason: 'malformed' },
    ]);
  }
}
