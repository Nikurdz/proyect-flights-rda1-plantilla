import { randomUUID } from 'node:crypto';
import * as http from 'node:http';

export type Modo = 'ok' | 'down' | 'refuse';

/** A partner service that speaks the Atracciones contract, with switches to make it fail. */
export function partnerFalso() {
  const estado = {
    modo: 'ok' as Modo,
    productos: [
      { id: 'p-1', name: 'City tour Quito', long_description: 'Recorrido por el centro histórico', duration: '3 horas', price: { currency: 'USD', total: 45 }, categories: ['Tours', 'Cultura'], photos: [{ url: 'https://img.example.com/1.jpg' }], product_type: 'GUIDED_TOUR', free_cancellation: true },
      { id: 'p-2', name: 'Teleférico', long_description: 'Subida al Pichincha', duration: '2 horas', price: { currency: 'USD', total: 20 }, categories: ['Aventura'], product_type: 'SINGLE_TICKET', free_cancellation: false },
      { name: 'Sin id ni precio' },
    ] as Record<string, unknown>[],
    reservas: new Map<string, { key: string; total: number }>(),
    llamadas: [] as string[],
    cancelaciones: [] as string[],
  };
  const server = http.createServer((req, res) => {
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://x');
      estado.llamadas.push(`${req.method} ${url.pathname}`);
      if (estado.modo === 'down') return send(503, { title: 'down' });
      if (req.method === 'GET' && url.pathname === '/api/v2/atracciones/health') return send(200);
      if (req.method === 'GET' && url.pathname === '/api/v2/atracciones') {
        const offset = Number(url.searchParams.get('offset') ?? 0);
        return send(200, { data: estado.productos.slice(offset, offset + Number(url.searchParams.get('limit') ?? 10)), meta: { totalItems: estado.productos.length } });
      }
      const reservar = /^\/api\/v2\/atracciones\/([^/]+)\/reservations$/.exec(url.pathname);
      if (req.method === 'POST' && reservar) {
        if (estado.modo === 'refuse') return send(409, { detail: 'No hay cupo para esa fecha' });
        const body = JSON.parse(raw) as { ticket_count: number };
        const key = String(req.headers['idempotency-key']);
        const previa = [...estado.reservas.entries()].find(([, r]) => r.key === key);
        const id = previa?.[0] ?? randomUUID();
        const producto = estado.productos.find((p) => p.id === reservar[1]) as { price: { total: number } };
        const total = producto.price.total * body.ticket_count;
        estado.reservas.set(id, { key, total });
        return send(201, { reservation_id: id, status: 'CONFIRMED', ticket_count: body.ticket_count, total_price: { currency: 'USD', total } });
      }
      const cancelar = /^\/api\/v2\/atracciones\/reservations\/([^/]+)\/cancel$/.exec(url.pathname);
      if (req.method === 'POST' && cancelar) {
        estado.cancelaciones.push(cancelar[1]);
        return send(200, { reservation_id: cancelar[1], status: 'CANCELLED' });
      }
      send(404, { detail: 'not found' });
    });
  });
  return { estado, server };
}
