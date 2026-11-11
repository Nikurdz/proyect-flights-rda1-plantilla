import { HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProblemDetailsException } from './problem-details.exception';

interface PgError {
  code?: string;
  detail?: string;
  constraint?: string;
}

/** The violated unique constraint's column list, e.g. "pnr" or "vueloId, seatNumber". */
export function uniqueViolationColumns(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) return null;
  const driverError = (error as QueryFailedError & { driverError?: PgError }).driverError;
  if (driverError?.code !== '23505') return null;
  return /Key \(([^)]+)\)/.exec(driverError.detail ?? '')?.[1] ?? '';
}

/** The values of the violated key, e.g. ["<vueloId>", "12A"] for `Key ("vueloId", "seatNumber")=(<id>, 12A)`. */
function uniqueViolationValues(error: unknown): string[] {
  if (!(error instanceof QueryFailedError)) return [];
  const detail = (error as QueryFailedError & { driverError?: PgError }).driverError?.detail ?? '';
  const values = /\)=\(([^)]*)\)/.exec(detail)?.[1];
  return values ? values.split(',').map((v) => v.trim()) : [];
}

/**
 * 409 SEAT_TAKEN. v1 and the web keep their generic text; v2 (Booking) names the seat and the segment
 * ("El asiento 12A del segmento <id> ya fue tomado.") as its contract example shows.
 */
export function seatTakenProblem(seatNumber?: string, segmentId?: string): ProblemDetailsException {
  const exception = new ProblemDetailsException(HttpStatus.CONFLICT, 'SEAT_TAKEN', 'Seat already taken', 'One of the requested seats was just taken by another booking.');
  const detail = seatNumber && segmentId ? `El asiento ${seatNumber} del segmento ${segmentId} ya fue tomado.` : 'Uno de los asientos solicitados ya fue tomado por otra reserva.';
  return exception.forV2('SEAT_TAKEN', HttpStatus.CONFLICT, { title: 'Asiento no disponible', detail });
}

/**
 * Turns a unique-constraint race (two requests generating the same PNR, e-ticket number,
 * seat or payment reference) into the contract's typed problem instead of a bare 500 that
 * would leak the SQL error text. Any other error is returned untouched.
 */
export function mapBookingUniqueViolation(error: unknown): unknown {
  const columns = uniqueViolationColumns(error);
  if (columns === null) return error;

  if (columns.includes('seatNumber')) {
    const [segmentId, seatNumber] = uniqueViolationValues(error);
    return seatTakenProblem(seatNumber, segmentId);
  }
  if (columns.includes('paymentReference')) {
    return new ProblemDetailsException(HttpStatus.CONFLICT, 'PAYMENT_REFERENCE_INVALID', 'Payment already used', 'This paymentReference is already attached to another booking.');
  }
  if (columns.includes('pnr')) {
    return new ProblemDetailsException(HttpStatus.CONFLICT, 'PNR_CREATION_FAILED', 'Could not allocate a record locator', 'Retry the request with the same Idempotency-Key.');
  }
  if (columns.includes('eTicketNumber')) {
    return new ProblemDetailsException(HttpStatus.CONFLICT, 'TICKET_ISSUANCE_FAILED', 'Could not allocate an e-ticket number', 'Retry the request with the same Idempotency-Key.');
  }
  return error;
}
