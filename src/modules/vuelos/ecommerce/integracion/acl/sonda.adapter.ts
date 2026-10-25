import { HttpStatus } from '@nestjs/common';
import { ProblemDetailsException } from '../../../common/problem-details.exception';
import type { TipoServicio } from '../entities/proveedor.entity';
import type { AdaptadorProveedor, DatosReservaExterna, ProductoExterno, ReservaRemota } from './adaptador-proveedor';
import type { ClienteProveedor } from './cliente-proveedor';

/**
 * Adapter for services whose contract (Autos, Alojamientos) is a search-and-book flow, not a catalogue: the platform can
 * watch them (health) but cannot import a catalogue or book yet. Selling them is a later phase; the error says so.
 */
export class SondaAdapter implements AdaptadorProveedor {
  constructor(
    readonly tipo: TipoServicio,
    private readonly cliente: ClienteProveedor,
    // Both contracts have a cheap GET /constants.
    private readonly rutaSalud = '/constants',
  ) {}

  async ping(baseUrl: string): Promise<number> {
    const respuesta = await this.cliente.llamar('GET', `${baseUrl}${this.rutaSalud}`);
    return respuesta.latenciaMs;
  }

  catalogo(): Promise<ProductoExterno[]> {
    return Promise.reject(this.noDisponible('importing a catalogue'));
  }

  reservar(_baseUrl: string, _externalId: string, _datos: DatosReservaExterna): Promise<ReservaRemota> {
    return Promise.reject(this.noDisponible('booking'));
  }

  cancelar(): Promise<void> {
    return Promise.reject(this.noDisponible('cancelling'));
  }

  private noDisponible(accion: string): ProblemDetailsException {
    return new ProblemDetailsException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'PROVIDER_ACTION_NOT_SUPPORTED',
      'Not available for this kind of provider',
      `${accion} is not available yet for ${this.tipo} providers: only their health is monitored.`,
    );
  }
}
