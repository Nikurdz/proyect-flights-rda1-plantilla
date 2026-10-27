import { CanActivate, ExecutionContext, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { TokenService } from '../../auth/token.service';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { hasScope, PARTNER_SCOPES, PartnerScope, USER_SCOPES } from './scopes';

const SCOPES_KEY = 'vuelos:v2-scopes';

/** The scope a v2 operation needs (any of them is enough). A route without it is public. */
export const RequiresScope = (...scopes: PartnerScope[]) => SetMetadata(SCOPES_KEY, scopes);

// Short enough that `partner:<clientId>:user:<id>` (clientId <= 30) fits the 100-character owner columns.
const USER_ID = /^[A-Za-z0-9._:@-]{1,50}$/;

/**
 * Authentication and authorisation of /api/v2/vuelos.
 *  - Public operations (no @RequiresScope) pass without a token.
 *  - A partner token (client_credentials, `scope` claim) acts for the end user named in X-User-Id: the owner becomes
 *    `partner:<clientId>:user:<id>`, a namespace of its own so a partner cannot reach the platform's own customers'
 *    bookings. Without the header the owner is `partner:<clientId>`. The header is only honoured with a service token.
 *    A webhook of `partner:<clientId>` hears the events of every user of that partner (see WebhooksService.enqueue).
 *  - A platform user token (the contract's "BearerAuth" alternative) gets the scopes of its role.
 */
@Injectable()
export class PartnerAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PartnerScope[] | undefined>(SCOPES_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ') || header.length <= 'Bearer '.length) {
      throw new ProblemDetailsException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Token requerido', 'Envíe un token Bearer válido en el encabezado Authorization.');
    }
    const claims = this.tokens.verify(header.slice('Bearer '.length));

    let granted: readonly string[];
    if (claims.kind === 'service') {
      granted = (claims.scopes ?? []).filter((s) => (PARTNER_SCOPES as readonly string[]).includes(s));
      const userId = request.headers['x-user-id'];
      const partner = `partner:${claims.ownerId}`;
      claims.ownerId = typeof userId === 'string' && USER_ID.test(userId) ? `${partner}:user:${userId}` : partner;
      const roles = request.headers['x-user-roles'];
      if (typeof roles === 'string') claims.roles = roles.split(',').map((r) => r.trim()).filter(Boolean);
    } else {
      granted = claims.scopes ?? (claims.roles.includes('ADMIN') ? [...PARTNER_SCOPES] : USER_SCOPES);
    }

    if (!required.some((scope) => hasScope(granted, scope))) {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Scope insuficiente', `La operación requiere el scope ${required.join(' o ')}.`);
    }
    request.auth = claims;
    return true;
  }
}
