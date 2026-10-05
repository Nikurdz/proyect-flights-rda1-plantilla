import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { uniqueViolationColumns } from '../../common/db-errors';
import { DomainEvent, DomainEventBus } from '../../common/domain-event-bus';
import { MercadosService } from '../mercados/mercados.service';
import { Notificacion, TipoNotificacion } from './entities/notificacion.entity';
import { PlantillaNotificacion } from './entities/plantilla.entity';
import { CANAL_MENSAJERIA, CanalMensajeria } from './ports/mensajeria.port';

const MAX_ATTEMPTS = 3;
const FALLBACK_LANGUAGE = 'es';

interface Envio {
  evento: DomainEvent;
  tipo: TipoNotificacion;
  destinatario: string;
  mercado: string | null;
  idioma: string;
  referencia: string;
  variables: Record<string, string>;
}

const fecha = (iso: string) => iso.replace('T', ' ').slice(0, 16) + ' UTC';

/**
 * D16. Turns domain events into transactional messages. Service messages (order confirmation,
 * account security) are always sent (RN-35); marketing is not part of this phase. Each message is
 * rendered from a versioned template for the market and language, sent through the channel port
 * with retries, and recorded with its outcome.
 */
@Injectable()
export class NotificacionesService implements OnModuleInit {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(Notificacion) private readonly notificaciones: Repository<Notificacion>,
    @InjectRepository(PlantillaNotificacion) private readonly plantillas: Repository<PlantillaNotificacion>,
    @Inject(CANAL_MENSAJERIA) private readonly canal: CanalMensajeria,
    private readonly mercados: MercadosService,
    private readonly events: DomainEventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('OrdenEmitida', (e) => this.alEmitirse(e));
    this.events.subscribe('OrdenFallidaCompensada', (e) => this.alFallarEmision(e));
    this.events.subscribe('ClienteRegistrado', (e) => this.alRegistrarse(e));
    this.events.subscribe('CuentaBloqueada', (e) => this.alBloquearse(e));
  }

  /** RF-NTF-001/RF-ORD-006: the e-mail twin of the confirmation screen. */
  private async alEmitirse(evento: DomainEvent): Promise<void> {
    const p = evento.payload as {
      numeroOrden: string;
      pnr: string;
      correo: string;
      idioma: string;
      total: string;
      itinerarios: { numeroVuelo: string; origen: string; destino: string; salida: string; llegada: string; familia: string }[];
      pasajeros: { nombres: string; apellidos: string; tipo: string; eTicket: string | null }[];
    };
    await this.enviar({
      evento,
      tipo: 'CONFIRMACION_COMPRA',
      destinatario: p.correo,
      mercado: evento.market,
      idioma: p.idioma,
      referencia: p.numeroOrden,
      variables: {
        nombre: `${p.pasajeros[0].nombres} ${p.pasajeros[0].apellidos}`,
        numeroOrden: p.numeroOrden,
        pnr: p.pnr,
        total: p.total,
        itinerario: p.itinerarios.map((i) => `${i.numeroVuelo}  ${i.origen} -> ${i.destino}  ${fecha(i.salida)} / ${fecha(i.llegada)}  (${i.familia})`).join('\n'),
        pasajeros: p.pasajeros.map((x) => `${x.nombres} ${x.apellidos} (${x.tipo})  billete ${x.eTicket ?? 'pendiente'}`).join('\n'),
      },
    });
  }

  private async alFallarEmision(evento: DomainEvent): Promise<void> {
    const p = evento.payload as { numeroOrden: string; correo: string; idioma: string };
    await this.enviar({ evento, tipo: 'EMISION_FALLIDA', destinatario: p.correo, mercado: evento.market, idioma: p.idioma, referencia: p.numeroOrden, variables: { numeroOrden: p.numeroOrden } });
  }

  private async alRegistrarse(evento: DomainEvent): Promise<void> {
    const p = evento.payload as { clienteId: string; correo: string; nombres: string; idioma: string; verificationToken: string };
    const base = process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000';
    await this.enviar({
      evento,
      tipo: 'VERIFICACION_CORREO',
      destinatario: p.correo,
      mercado: evento.market,
      idioma: p.idioma,
      referencia: p.clienteId,
      variables: { nombre: p.nombres, enlace: `${base}/verificar-correo?token=${p.verificationToken}`, token: p.verificationToken },
    });
  }

  private async alBloquearse(evento: DomainEvent): Promise<void> {
    const p = evento.payload as { clienteId: string; correo: string; nombres: string; idioma: string; minutos: number };
    await this.enviar({ evento, tipo: 'CUENTA_BLOQUEADA', destinatario: p.correo, mercado: evento.market, idioma: p.idioma, referencia: p.clienteId, variables: { nombre: p.nombres, minutos: String(p.minutos) } });
  }

  async enviar(envio: Envio): Promise<void> {
    const plantilla = await this.resolverPlantilla(envio.tipo, envio.mercado, envio.idioma);
    if (!plantilla) {
      this.logger.error(`No template for ${envio.tipo} (${envio.mercado ?? 'any market'}, ${envio.idioma}); message not sent`);
      return;
    }

    // RF-MKT-008: the legal entity and terms of the market go in every message footer.
    const mercado = envio.mercado ? await this.mercados.obtener(envio.mercado).catch(() => null) : null;
    const variables = {
      razonSocial: mercado?.textosLegales.razonSocial ?? '',
      urlTerminos: mercado?.textosLegales.terminos.url ?? '',
      ...envio.variables,
    };
    const asunto = this.renderizar(plantilla.asunto, variables);
    const cuerpo = this.renderizar(plantilla.cuerpo, variables);

    let registro: Notificacion;
    try {
      registro = await this.notificaciones.save(
        this.notificaciones.create({
          eventoId: envio.evento.id,
          tipo: envio.tipo,
          canal: 'EMAIL',
          destinatario: envio.destinatario,
          mercado: envio.mercado,
          idioma: plantilla.idioma,
          plantillaVersion: plantilla.version,
          asunto,
          cuerpo,
          referencia: envio.referencia,
          estado: 'FALLIDO',
          intentos: 0,
        }),
      );
    } catch (error) {
      if (uniqueViolationColumns(error)?.includes('eventoId')) return; // already handled: redelivered event
      throw error;
    }

    for (let intento = 1; intento <= MAX_ATTEMPTS; intento++) {
      registro.intentos = intento;
      try {
        await this.canal.enviar({ canal: 'EMAIL', destinatario: envio.destinatario, asunto, cuerpo });
        registro.estado = 'ENVIADO';
        registro.error = null;
        break;
      } catch (error) {
        registro.error = (error instanceof Error ? error.message : String(error)).slice(0, 300);
        this.logger.warn(`Attempt ${intento}/${MAX_ATTEMPTS} sending ${envio.tipo} to the customer failed: ${registro.error}`);
      }
    }
    await this.notificaciones.save(registro);
  }

  /** Most specific first: this market + language, then any market + language, then the fallback language. */
  async resolverPlantilla(tipo: string, mercado: string | null, idioma: string): Promise<PlantillaNotificacion | null> {
    for (const lang of [...new Set([idioma, FALLBACK_LANGUAGE])]) {
      const candidatas = await this.plantillas.find({
        where: [
          { tipo, idioma: lang, activa: true, mercado: mercado ?? IsNull() },
          { tipo, idioma: lang, activa: true, mercado: IsNull() },
        ],
        order: { version: 'DESC' },
      });
      const elegida = candidatas.find((p) => p.mercado === mercado) ?? candidatas.find((p) => p.mercado === null);
      if (elegida) return elegida;
    }
    return null;
  }

  /** Replaces {{name}} with the value as-is: a value containing "{{x}}" is never expanded again. */
  renderizar(texto: string, variables: Record<string, string>): string {
    return texto.replace(/\{\{(\w+)\}\}/g, (_match, nombre: string) => variables[nombre] ?? '');
  }

  async listar(filtros: { referencia?: string; destinatario?: string }): Promise<Notificacion[]> {
    return this.notificaciones.find({ where: filtros, order: { creadoEn: 'DESC' }, take: 50 });
  }
}
