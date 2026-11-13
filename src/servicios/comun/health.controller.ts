import { Controller, Get } from '@nestjs/common';

export interface SateliteHealth {
  status: 'UP';
  servicio: string;
}

/**
 * `GET /health` of a satellite service: it only says the process is alive (no database, no broker), so an orchestrator can
 * probe it without waking anything. It has no global prefix: the satellites have no public API.
 */
export function crearHealthController(servicio: string): new () => { health(): SateliteHealth } {
  @Controller('health')
  class SateliteHealthController {
    @Get()
    health(): SateliteHealth {
      return { status: 'UP', servicio };
    }
  }
  return SateliteHealthController;
}
