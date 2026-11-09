import { Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { WebhookEntregaParamDto, WebhookEntregasQueryDto } from './webhooks-admin.dto';
import { WebhooksAdminService } from './webhooks-admin.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT } = HttpStatus;

/** Webhook subscriptions and deliveries of every owner (ADMIN), to follow what reached each partner. */
@ProblemController('admin/webhooks', 'E-commerce · Back-office')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class WebhooksAdminController {
  constructor(private readonly webhooks: WebhooksAdminService) {}

  @Get('suscripciones')
  @ApiOperation({ summary: 'Suscripciones de webhooks de todos los dueños (ADMIN)', description: 'URL, eventos, versión del contrato y entregas por estado. El secreto nunca se devuelve.' })
  @ApiResponse({ status: 200, description: 'Suscripciones con el conteo de sus entregas.' })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN)
  suscripciones() {
    return this.webhooks.suscripciones();
  }

  @Get('entregas')
  @ApiOperation({ summary: 'Entregas de webhooks (ADMIN)', description: 'Cada evento enviado a cada suscripción: estado, intentos, próximo intento, último código o error y la reserva a la que se refiere.' })
  @ApiResponse({ status: 200, description: 'Página de entregas, las más recientes primero.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  entregas(@Query() query: WebhookEntregasQueryDto) {
    return this.webhooks.entregas(query);
  }

  @Post('entregas/:deliveryId/reintentar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reintentar una entrega (ADMIN)', description: 'Vuelve a encolar una entrega muerta o pendiente con el mismo cuerpo firmado; una ya entregada responde 409.' })
  @ApiResponse({ status: 200, description: 'La entrega quedó en cola.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  reintentar(@CurrentAuth() auth: AuthClaims, @Param() params: WebhookEntregaParamDto) {
    return this.webhooks.reintentar(auth, params.deliveryId);
  }
}
