import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { from, Observable, switchMap } from 'rxjs';
import { AirportZones } from '../common/airport-zones';
import { toZonedBody } from '../common/zoned-time';

/**
 * Writes every instant of a contract v2 answer with its real UTC offset (same instant as the `…Z` the services produce):
 * a flight's departure in the zone of its origin airport, its arrival in that of its destination, the rest in
 * America/Guayaquil. The rules and the recognised keys are in `common/zoned-time.ts`. Error bodies are converted in
 * `VuelosProblemDetailsV2Filter`, webhook deliveries in `WebhookDispatcherService`.
 */
@Injectable()
export class ZonedTimeInterceptor implements NestInterceptor {
  constructor(private readonly zones: AirportZones) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(switchMap((body) => from(toZonedBody(body, this.zones))));
  }
}
