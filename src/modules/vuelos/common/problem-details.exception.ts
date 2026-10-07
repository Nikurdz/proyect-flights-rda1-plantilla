import { HttpException, HttpStatus } from '@nestjs/common';

// Exactly the ProblemDetails.code enum of contracts/vuelos-openapi.yaml.
export type ContractProblemCode =
  | 'VALIDATION_FAILED'
  | 'SEAT_TAKEN'
  | 'AMOUNT_MISMATCH'
  | 'BOOKING_NOT_CONFIRMED'
  | 'BAGGAGE_LIMIT_EXCEEDED'
  | 'CUTOFF_PASSED'
  | 'FARE_NOT_CHANGEABLE'
  | 'FLIGHT_ALREADY_DEPARTED'
  | 'CHANGE_OFFER_EXPIRED'
  | 'OFFER_NO_LONGER_AVAILABLE'
  | 'QUOTE_EXPIRED'
  | 'ALREADY_CANCELLED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INFANT_SEAT_NOT_ALLOWED'
  | 'PAYMENT_REFERENCE_INVALID'
  | 'PAYMENT_NOT_AUTHORIZED'
  | 'PNR_CREATION_FAILED'
  | 'TICKET_ISSUANCE_FAILED'
  | 'TICKET_ALREADY_ISSUED'
  | 'CHECK_IN_NOT_AVAILABLE'
  | 'CHECK_IN_FAILED'
  | 'BOARDING_PASS_NOT_AVAILABLE'
  | 'SEAT_CABIN_MISMATCH'
  | 'FLIGHT_STATUS_NOT_AVAILABLE';

// The contract defines no 401, 500, 501 or 503 response, so these statuses get codes of
// our own rather than a misleading contract code. Kept in a separate union so the
// extension is explicit and greppable.
export type ExtensionProblemCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'SERVICE_UNAVAILABLE'
  // E-commerce layer (SRS D01-D09): business failures with no counterpart in the GDS contract.
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'TOO_MANY_ATTEMPTS'
  | 'MARKET_NOT_AVAILABLE'
  | 'OFFER_EXPIRED'
  | 'OFFER_INCOMPLETE'
  | 'OFFER_NOT_PAYABLE'
  | 'PRICE_CHANGED'
  | 'CONDITIONS_VERSION_MISMATCH'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_REJECTED_BY_FRAUD'
  | 'PAYMENT_METHOD_NOT_ALLOWED'
  | 'ORDER_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'ISSUANCE_FAILED_COMPENSATED';

// Nest's HttpStatus has no 423; used for temporarily locked accounts.
export const HTTP_LOCKED = 423 as HttpStatus;

export type ProblemDetailsCode = ContractProblemCode | ExtensionProblemCode;

export interface InvalidParam {
  name: string;
  reason: string;
}

export interface ProblemDetailsBody {
  type: string;
  title: string;
  status: number;
  code: ProblemDetailsCode;
  detail?: string;
  invalidParams?: InvalidParam[];
}

export function isProblemDetailsBody(value: unknown): value is ProblemDetailsBody {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.type === 'string' &&
    typeof body.title === 'string' &&
    typeof body.status === 'number' &&
    typeof body.code === 'string'
  );
}

/** RFC 7807 problem whose shape matches the contract's ProblemDetails schema. */
export class ProblemDetailsException extends HttpException {
  /** Sent as the Retry-After header (429, and 409 for a request still in progress); never part of the body. */
  readonly retryAfterSeconds?: number;

  constructor(
    status: HttpStatus,
    code: ProblemDetailsCode,
    title: string,
    detail: string,
    invalidParams?: InvalidParam[],
    retryAfterSeconds?: number,
  ) {
    const body: ProblemDetailsBody = {
      type: `https://api.booking-hub.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status,
      code,
      detail,
    };
    if (invalidParams?.length) {
      body.invalidParams = invalidParams;
    }
    super(body, status);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
