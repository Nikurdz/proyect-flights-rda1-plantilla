import { ConfigService } from '@nestjs/config';
import { DomainEventBus } from '../common/domain-event-bus';
import { EXCHANGE, MAX_REINTENTOS, Q_COMPENSACION, Q_CONFIRMADAS, Q_GENERAL, RabbitMqTransport, colaDe } from './rabbitmq.transport';

interface Publicado {
  exchange: string;
  key: string;
  evento: { type: string };
  retries: number;
}

/** A broker that does nothing but remember what it was asked, so the transport's logic can be checked without RabbitMQ. */
function brokerFalso(opciones: { falloPublicar?: boolean } = {}) {
  const consumidores = new Map<string, (m: unknown) => void>();
  const publicados: Publicado[] = [];
  const acks: unknown[] = [];
  const nacks: { mensaje: unknown; requeue: boolean }[] = [];
  const canal = {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue(undefined),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn((cola: string, cb: (m: unknown) => void) => {
      consumidores.set(cola, cb);
      return Promise.resolve({ consumerTag: cola });
    }),
    publish: jest.fn((exchange: string, key: string, contenido: Buffer, opts: { headers: { 'x-retries': number } }, cb: (e?: Error) => void) => {
      if (opciones.falloPublicar) return cb(new Error('broker refused'));
      publicados.push({ exchange, key, evento: JSON.parse(contenido.toString()), retries: opts.headers['x-retries'] });
      cb();
      return true;
    }),
    ack: jest.fn((m: unknown) => acks.push(m)),
    nack: jest.fn((mensaje: unknown, _all: boolean, requeue: boolean) => nacks.push({ mensaje, requeue })),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const conexion = { on: jest.fn(), createConfirmChannel: jest.fn().mockResolvedValue(canal), close: jest.fn().mockResolvedValue(undefined) };
  const conectar = jest.fn().mockResolvedValue(conexion);
  /** What the broker would hand a consumer for a published message. */
  const entrega = (p: Publicado) => ({ content: Buffer.from(JSON.stringify(p.evento)), properties: { headers: { 'x-retries': p.retries } } });
  return { canal, conectar, consumidores, publicados, acks, nacks, entrega };
}

const config = (url?: string) => ({ get: (k: string) => (k === 'RABBITMQ_URL' ? url : undefined) }) as unknown as ConfigService;

describe('RabbitMqTransport', () => {
  const crear = async (url: string | undefined, broker = brokerFalso()) => {
    const bus = new DomainEventBus();
    const transporte = new RabbitMqTransport(bus, config(url), broker.conectar);
    await transporte.onModuleInit();
    return { bus, transporte, broker };
  };

  it('routes each event to the queue of its kind', () => {
    expect(colaDe('OrdenEmitida')).toBe(Q_CONFIRMADAS);
    expect(colaDe('ReservaExternaConfirmada')).toBe(Q_CONFIRMADAS);
    expect(colaDe('OrdenFallidaCompensada')).toBe(Q_COMPENSACION);
    expect(colaDe('PagoAnulado')).toBe(Q_COMPENSACION);
    expect(colaDe('proveedor.salud')).toBe(Q_GENERAL);
  });

  it('does nothing without RABBITMQ_URL: events stay in process', async () => {
    const { bus, transporte, broker } = await crear(undefined);
    const visto = jest.fn();
    bus.subscribe('X', visto);
    await bus.publish('X', 'a1', {});
    expect(broker.conectar).not.toHaveBeenCalled();
    expect(transporte.activo).toBe(false);
    expect(visto).toHaveBeenCalledTimes(1);
  });

  it('declares the topology, publishes through the exchange and runs the consumers only when the broker delivers', async () => {
    const { bus, transporte, broker } = await crear('amqp://fake');
    expect(transporte.activo).toBe(true);
    expect(broker.canal.assertExchange).toHaveBeenCalledWith(EXCHANGE, 'direct', { durable: true });
    expect(broker.canal.assertQueue).toHaveBeenCalledWith(Q_CONFIRMADAS, expect.objectContaining({ arguments: { 'x-dead-letter-exchange': 'booking.dlx' } }));

    const visto = jest.fn();
    bus.subscribe('OrdenEmitida', visto);
    await bus.publish('OrdenEmitida', 'o1', { ordenId: 'o1', numeroOrden: 'ORD-1', correo: 'a@b.com' });
    expect(visto).not.toHaveBeenCalled(); // it went to the broker, not to the consumers
    expect(broker.publicados).toHaveLength(1);
    expect(broker.publicados[0]).toMatchObject({ exchange: EXCHANGE, key: Q_CONFIRMADAS, retries: 0 });

    const mensaje = broker.entrega(broker.publicados[0]);
    broker.consumidores.get(Q_CONFIRMADAS)!(mensaje);
    await new Promise((r) => setImmediate(r));
    expect(visto).toHaveBeenCalledTimes(1);
    expect(broker.acks).toContain(mensaje);
    expect(transporte.contadores).toMatchObject({ publicados: 1, consumidos: 1 });
    await transporte.onModuleDestroy();
  });

  it('re-publishes a message whose consumer fails, up to three times, then dead-letters it', async () => {
    const { bus, transporte, broker } = await crear('amqp://fake');
    bus.subscribe('PagoAnulado', () => {
      throw new Error('boom');
    });
    await bus.publish('PagoAnulado', 'p1', { pagoId: 'p1' });

    for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
      const ultimo = broker.publicados[broker.publicados.length - 1];
      expect(ultimo.retries).toBe(intento);
      broker.consumidores.get(Q_COMPENSACION)!(broker.entrega(ultimo));
      await new Promise((r) => setImmediate(r));
    }
    expect(broker.publicados.map((p) => p.retries)).toEqual([0, 1, 2, 3]); // the original and three retries
    expect(broker.nacks).toHaveLength(1);
    expect(broker.nacks[0].requeue).toBe(false); // → q.dead_letter through the dead-letter exchange
    expect(transporte.contadores).toMatchObject({ reintentados: 3, muertos: 1, consumidos: 0 });
    await transporte.onModuleDestroy();
  });

  it('dead-letters a message that is not an event', async () => {
    const { transporte, broker } = await crear('amqp://fake');
    const basura = { content: Buffer.from('not json'), properties: { headers: {} } };
    broker.consumidores.get(Q_GENERAL)!(basura);
    expect(broker.nacks).toEqual([{ mensaje: basura, requeue: false }]);
    await transporte.onModuleDestroy();
  });

  it('falls back to in-process delivery when the broker refuses, so no event is lost', async () => {
    const { bus, transporte } = await crear('amqp://fake', brokerFalso({ falloPublicar: true }));
    const visto = jest.fn();
    bus.subscribe('OrdenEmitida', visto);
    await bus.publish('OrdenEmitida', 'o1', { ordenId: 'o1', numeroOrden: 'ORD-1', correo: 'a@b.com' });
    expect(visto).toHaveBeenCalledTimes(1);
    await transporte.onModuleDestroy();
  });

  it('starts anyway when the broker is not there, and delivers in process', async () => {
    const broker = brokerFalso();
    broker.conectar.mockRejectedValue(new Error('ECONNREFUSED'));
    const { bus, transporte } = await crear('amqp://fake', broker);
    const visto = jest.fn();
    bus.subscribe('X', visto);
    await bus.publish('X', 'a', {});
    expect(transporte.activo).toBe(false);
    expect(visto).toHaveBeenCalledTimes(1);
    await transporte.onModuleDestroy(); // cancels the reconnection timer
  });
});
