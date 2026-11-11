import { Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { CatalogoService } from './catalogo.service';
import {
  DisponibilidadQueryDto,
  DisponibilidadViewDto,
  LocalidadesQueryDto,
  LocalidadViewDto,
  TarifasParamDto,
  TarifasQueryDto,
  TarifasViewDto,
} from './dto/catalogo.dto';

const { BAD_REQUEST, NOT_FOUND, UNPROCESSABLE_ENTITY, SERVICE_UNAVAILABLE } = HttpStatus;

@ProblemController('', 'E-commerce · Búsqueda')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get('localidades')
  @ApiOperation({ summary: 'Sugerir ciudades y aeropuertos', description: 'RF-SHP-001/002: prefijo sobre código, ciudad y aeropuerto, sin distinguir acentos ni mayúsculas.' })
  @ApiResponse({ status: 200, type: [LocalidadViewDto] })
  @ApiProblemResponses(BAD_REQUEST)
  sugerir(@Query() query: LocalidadesQueryDto) {
    return this.catalogo.sugerirLocalidades(query.q);
  }

  @Get('disponibilidad')
  @ApiOperation({
    summary: 'Buscar vuelos disponibles',
    description:
      'RF-SHP-004..024. Los criterios son los parámetros del enlace profundo (origin, destination, outbound, inbound, adt, chd, inf, trip, cabin, sort). ' +
      'Un trayecto sin vuelos se devuelve vacío con fechas alternativas, no como error. Solo vuelos directos en cabina económica.',
  })
  @ApiResponse({ status: 200, type: DisponibilidadViewDto })
  @ApiProblemResponses(BAD_REQUEST, NOT_FOUND, UNPROCESSABLE_ENTITY, SERVICE_UNAVAILABLE)
  disponibilidad(@Query() query: DisponibilidadQueryDto) {
    return this.catalogo.buscarDisponibilidad(query);
  }

  @Get('itinerarios/:id/tarifas')
  @ApiOperation({ summary: 'Comparar las familias tarifarias de un itinerario', description: 'RF-PRC-002/003/005/009: precios con impuestos por pasajero, condiciones estructuradas y vigencia.' })
  @ApiResponse({ status: 200, type: TarifasViewDto })
  @ApiProblemResponses(BAD_REQUEST, NOT_FOUND, UNPROCESSABLE_ENTITY, SERVICE_UNAVAILABLE)
  tarifas(@Param() params: TarifasParamDto, @Query() query: TarifasQueryDto) {
    return this.catalogo.tarifasDeItinerario(params.id, query);
  }
}
