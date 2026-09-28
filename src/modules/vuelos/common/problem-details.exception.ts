import { HttpException, HttpStatus } from '@nestjs/common';

// Subset of contracts/vuelos-openapi.yaml's components.schemas.ProblemDetails.code enum
// actually reachable from the logic implemented in this pass.
export type ProblemDetailsCode =
  | 'VALIDATION_FAILED'
  | 'INFANT_SEAT_NOT_ALLOWED'
  | 'OFFER_NO_LONGER_AVAILABLE'
  | 'QUOTE_EXPIRED'
  | 'BOOKING_NOT_CONFIRMED'
  | 'PAYMENT_REFERENCE_INVALID'
  | 'FLIGHT_STATUS_NOT_AVAILABLE';

/** Mirrors the ProblemDetails shape IdempotencyKeyGuard already throws by hand. */
export class ProblemDetailsException extends HttpException {
  constructor(status: HttpStatus, code: ProblemDetailsCode, title: string, detail: string) {
    super(
      {
        type: `https://api.booking-hub.com/errors/${code.toLowerCase()}`,
        title,
        status,
        code,
        detail,
      },
      status,
    );
  }
}
