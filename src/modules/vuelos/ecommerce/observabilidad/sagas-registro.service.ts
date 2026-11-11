import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { currentCorrelationId } from '../../common/correlation';
import { AuditoriaSaga, AuditoriaSagaPaso, EstadoPasoSaga, EstadoSaga } from './entities/auditoria.entity';

/** The trace of one saga run. Every method is safe to call: a failure to record is logged and never reaches the saga. */
export class SagaTrace {
  private secuencia = 0;
  private ultimo = Date.now();

  constructor(
    private readonly sagas: Repository<AuditoriaSaga>,
    private readonly pasos: Repository<AuditoriaSagaPaso>,
    private readonly logger: Logger,
    readonly sagaId: string | null,
  ) {}

  /** Records a step that has just finished; its duration is the time since the previous step (or the start). */
  async paso(nombre: string, estado: EstadoPasoSaga, detalle?: string): Promise<void> {
    if (!this.sagaId) return;
    const ahora = Date.now();
    const duracionMs = ahora - this.ultimo;
    this.ultimo = ahora;
    try {
      await this.pasos.insert({ sagaId: this.sagaId, secuencia: ++this.secuencia, nombre: nombre.slice(0, 40), estado, detalle: detalle?.slice(0, 300) ?? null, duracionMs, en: new Date(ahora) });
    } catch (error) {
      this.logger.warn(`Could not record saga step ${nombre}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async finalizar(estado: Exclude<EstadoSaga, 'EN_CURSO'>, error?: string): Promise<void> {
    if (!this.sagaId) return;
    try {
      await this.sagas.update({ sagaId: this.sagaId }, { estado, error: error?.slice(0, 300) ?? null, finalizadaEn: new Date() });
    } catch (e) {
      this.logger.warn(`Could not close saga ${this.sagaId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

/** Opens the trace of a saga (`auditoria_sagas` + `auditoria_saga_pasos`). */
@Injectable()
export class SagasRegistroService {
  private readonly logger = new Logger(SagasRegistroService.name);

  constructor(
    @InjectRepository(AuditoriaSaga) private readonly sagas: Repository<AuditoriaSaga>,
    @InjectRepository(AuditoriaSagaPaso) private readonly pasos: Repository<AuditoriaSagaPaso>,
  ) {}

  async iniciar(tipo: string, referencia: string, propietarioId: string): Promise<SagaTrace> {
    try {
      const saga = await this.sagas.save(
        this.sagas.create({ tipo, referencia, propietarioId, correlationId: currentCorrelationId(), estado: 'EN_CURSO', error: null, iniciadaEn: new Date(), finalizadaEn: null }),
      );
      return new SagaTrace(this.sagas, this.pasos, this.logger, saga.sagaId);
    } catch (error) {
      this.logger.warn(`Could not open saga trace (${tipo} ${referencia}): ${error instanceof Error ? error.message : String(error)}`);
      return new SagaTrace(this.sagas, this.pasos, this.logger, null);
    }
  }
}
