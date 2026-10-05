import { Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsOptional, Matches, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { NotificacionesService } from './notificaciones.service';

class NotificacionesQueryDto {
  @ApiProperty({ required: false, description: 'Número de orden o id de cliente al que se refiere el mensaje.' })
  @Matches(/^[\w-]{1,100}$/)
  @IsOptional()
  referencia?: string;

  @ApiProperty({ required: false })
  @MaxLength(150)
  @IsOptional()
  destinatario?: string;
}

/** Read-only trace of what the platform sent (RF-NTF-008); in development it is also where a verification link can be read. */
@ProblemController('admin', 'E-commerce · Back-office')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminNotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get('notificaciones')
  @ApiOperation({ summary: 'Mensajes enviados (ADMIN)', description: 'Filtre por referencia o destinatario. El cuerpo se descifra solo para este rol.' })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  async listar(@Query() query: NotificacionesQueryDto) {
    if (!query.referencia && !query.destinatario) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'A filter is required', 'Send referencia or destinatario.', [{ name: 'referencia', reason: 'send referencia or destinatario' }]);
    }
    const filas = await this.notificaciones.listar(query);
    return filas.map(({ notificacionId, tipo, canal, destinatario, asunto, cuerpo, estado, intentos, plantillaVersion, creadoEn }) => ({
      notificacionId,
      tipo,
      canal,
      destinatario,
      asunto,
      cuerpo,
      estado,
      intentos,
      plantillaVersion,
      creadoEn,
    }));
  }
}
