import { Injectable } from '@nestjs/common';
import { minorDigits } from '../../common/moneda.util';
import { AdaptadorProveedor, DatosReservaExterna, ProductoExterno, RechazoProveedorError, ReservaRemota } from './adaptador-proveedor';
import { ClienteProveedor } from './cliente-proveedor';

const PAGE = 50;

interface AtraccionRemota {
  id?: unknown;
  name?: unknown;
  long_description?: unknown;
  duration?: unknown;
  price?: { currency?: unknown; total?: unknown };
  categories?: unknown;
  photos?: { url?: unknown }[];
  product_type?: unknown;
  free_cancellation?: unknown;
}

const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Anti-corruption layer for the Atracciones team's service (contracts/socios/atracciones-openapi.yaml). It turns that
 * contract (snake_case, decimal prices) into the platform's own types and tolerates missing fields: a partner that
 * forgets one does not break the synchronisation, its product is just skipped or filled with a default.
 */
@Injectable()
export class AtraccionesAdapter implements AdaptadorProveedor {
  readonly tipo = 'ATRACCIONES' as const;

  constructor(private readonly cliente: ClienteProveedor) {}

  async ping(baseUrl: string): Promise<number> {
    const respuesta = await this.cliente.llamar('GET', `${baseUrl}/atracciones/health`);
    return respuesta.latenciaMs;
  }

  async catalogo(baseUrl: string, max: number): Promise<ProductoExterno[]> {
    const productos: ProductoExterno[] = [];
    for (let offset = 0; productos.length < max; offset += PAGE) {
      const respuesta = await this.cliente.llamar('GET', `${baseUrl}/atracciones?limit=${PAGE}&offset=${offset}`);
      if (respuesta.status >= 400) throw new RechazoProveedorError(`the catalogue request was refused (${respuesta.status})`, respuesta.status);
      const data = (respuesta.json as { data?: AtraccionRemota[] } | null)?.data;
      if (!Array.isArray(data) || data.length === 0) break;
      for (const remota of data) {
        const producto = this.traducir(remota);
        if (producto) productos.push(producto);
      }
      if (data.length < PAGE) break;
    }
    return productos.slice(0, max);
  }

  async reservar(baseUrl: string, externalId: string, datos: DatosReservaExterna, idempotencyKey: string): Promise<ReservaRemota> {
    const respuesta = await this.cliente.llamar(
      'POST',
      `${baseUrl}/atracciones/${encodeURIComponent(externalId)}/reservations`,
      { date: datos.fecha, ...(datos.hora ? { time: datos.hora } : {}), ticket_count: datos.cantidad, customer_name: datos.nombre, customer_email: datos.correo },
      { 'Idempotency-Key': idempotencyKey },
    );
    const json = respuesta.json as { reservation_id?: unknown; status?: unknown; total_price?: { currency?: unknown; total?: unknown }; detail?: unknown } | null;
    if (respuesta.status >= 400) throw new RechazoProveedorError(texto(json?.detail, 200) || `the reservation was refused (${respuesta.status})`, respuesta.status);
    if (typeof json?.reservation_id !== 'string') throw new RechazoProveedorError('the partner confirmed without a reservation id', 502);
    const estado = json.status === 'PENDING' || json.status === 'CANCELLED' ? json.status : 'CONFIRMED';
    const moneda = texto(json.total_price?.currency, 3) || 'USD';
    const totalMinor = typeof json.total_price?.total === 'number' ? Math.round(json.total_price.total * 10 ** minorDigits(moneda)) : null;
    return { reservationId: json.reservation_id, estado, totalMinor };
  }

  async cancelar(baseUrl: string, reservationId: string, motivo: string, idempotencyKey: string): Promise<void> {
    const respuesta = await this.cliente.llamar('POST', `${baseUrl}/atracciones/reservations/${encodeURIComponent(reservationId)}/cancel`, { reason: motivo.slice(0, 200) }, { 'Idempotency-Key': idempotencyKey });
    // 404 means the partner no longer knows it; 409 that it is already cancelled: both leave nothing to cancel.
    if (respuesta.status >= 400 && respuesta.status !== 404 && respuesta.status !== 409) throw new RechazoProveedorError(`the cancellation was refused (${respuesta.status})`, respuesta.status);
  }

  private traducir(remota: AtraccionRemota): ProductoExterno | null {
    const externalId = typeof remota.id === 'string' || typeof remota.id === 'number' ? String(remota.id) : '';
    const nombre = texto(remota.name, 200);
    const total = remota.price?.total;
    if (!externalId || !nombre || typeof total !== 'number' || total < 0) return null; // unusable: a product needs a name and a price
    const moneda = texto(remota.price?.currency, 3).toUpperCase() || 'USD';
    const foto = remota.photos?.find((p) => typeof p?.url === 'string')?.url;
    return {
      externalId: externalId.slice(0, 100),
      tipo: texto(remota.product_type, 30) || 'SINGLE_TICKET',
      nombre,
      descripcion: texto(remota.long_description, 4000),
      duracion: texto(remota.duration, 60) || null,
      precioMinor: Math.round(total * 10 ** minorDigits(moneda)),
      moneda,
      imagenUrl: typeof foto === 'string' ? foto.slice(0, 500) : null,
      cancelacionGratis: remota.free_cancellation === true,
      categorias: Array.isArray(remota.categories) ? [...new Set(remota.categories.filter((c): c is string => typeof c === 'string').map((c) => c.trim().slice(0, 60)).filter(Boolean))] : [],
    };
  }
}
