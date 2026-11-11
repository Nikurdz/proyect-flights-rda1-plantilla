import { Injectable, Logger } from '@nestjs/common';
import type { ProblemDetailsBody } from '../common/problem-details.exception';
import { SagasRegistroService } from '../ecommerce/observabilidad/sagas-registro.service';

/** What the caller answers when a saga fails: the HTTP status and problem, and the short reason that is recorded. */
export class SagaFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: ProblemDetailsBody['code'],
    readonly titulo: string,
    readonly detalle: string,
    readonly motivo: string,
  ) {
    super(motivo);
  }
}

export interface Compensacion<C> {
  nombre: string;
  hacer(ctx: C): Promise<string | void>;
}

export interface PasoSaga<C> {
  nombre: string;
  /** Does the work. Throw a `SagaFailure` to stop with a specific answer; any other error becomes a generic failure. May return a short detail to record. */
  hacer(ctx: C): Promise<string | void>;
  /** Undoes the step if a LATER step fails. Runs in reverse order, never throws out of the orchestrator. */
  compensar?: Compensacion<C>;
}

export interface DefinicionSaga {
  tipo: string;
  referencia: string;
  propietarioId: string;
}

export type ResultadoSaga<C> = { ok: true; ctx: C } | { ok: false; ctx: C; falla: SagaFailure; compensados: string[] };

/**
 * Runs a business process as an ordered list of steps with compensation (the saga pattern). Each step is recorded in
 * `auditoria_saga_pasos`; when a step fails the completed ones are compensated in reverse order (LIFO) and the saga is
 * closed as COMPENSADA (something was undone) or FALLIDA (nothing had to be). The orchestrator knows nothing about
 * HTTP: the caller turns the `SagaFailure` into its answer.
 */
@Injectable()
export class SagaOrchestrator {
  private readonly logger = new Logger(SagaOrchestrator.name);

  constructor(private readonly registro: SagasRegistroService) {}

  async ejecutar<C>(def: DefinicionSaga, ctx: C, pasos: PasoSaga<C>[], opciones: { alFallar?: (falla: SagaFailure, ctx: C) => Promise<void> } = {}): Promise<ResultadoSaga<C>> {
    const traza = await this.registro.iniciar(def.tipo, def.referencia, def.propietarioId);
    const hechos: PasoSaga<C>[] = [];

    for (const paso of pasos) {
      try {
        const detalle = await paso.hacer(ctx);
        await traza.paso(paso.nombre, 'OK', detalle || undefined);
        hechos.push(paso);
      } catch (error) {
        const falla =
          error instanceof SagaFailure
            ? error
            : new SagaFailure(502, 'INTERNAL_ERROR', 'The operation could not be completed', 'An unexpected error stopped the operation.', error instanceof Error ? error.message.slice(0, 200) : 'unknown_error');
        if (!(error instanceof SagaFailure)) this.logger.error(`Saga ${def.tipo} ${def.referencia} failed at ${paso.nombre}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
        await traza.paso(paso.nombre, 'ERROR', falla.motivo);

        const compensados: string[] = [];
        for (const hecho of [...hechos].reverse()) {
          if (!hecho.compensar) continue;
          try {
            const detalle = await hecho.compensar.hacer(ctx);
            await traza.paso(hecho.compensar.nombre, 'COMPENSADO', detalle || undefined);
            compensados.push(hecho.compensar.nombre);
          } catch (compensationError) {
            // The compensation itself failed: say so, keep undoing the rest, and leave it for a person.
            const motivo = compensationError instanceof Error ? compensationError.message.slice(0, 200) : 'unknown_error';
            this.logger.error(`Compensation ${hecho.compensar.nombre} failed for saga ${def.tipo} ${def.referencia}: ${motivo}. Settle it by hand.`);
            await traza.paso(hecho.compensar.nombre, 'ERROR', motivo);
          }
        }
        await traza.finalizar(compensados.length > 0 ? 'COMPENSADA' : 'FALLIDA', falla.motivo);
        if (opciones.alFallar) await opciones.alFallar(falla, ctx).catch((e: unknown) => this.logger.error(`alFallar of saga ${def.tipo} failed: ${e instanceof Error ? e.message : String(e)}`));
        return { ok: false, ctx, falla, compensados };
      }
    }
    await traza.finalizar('COMPLETADA');
    return { ok: true, ctx };
  }
}
