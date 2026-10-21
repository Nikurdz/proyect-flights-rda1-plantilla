import { CanActivate, ExecutionContext, HttpStatus, Injectable, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { AuthClaims, TokenService } from './token.service';

export type AuthenticatedRequest = Request & { auth?: AuthClaims };

/**
 * Fail-closed authentication: a request without a valid signed Bearer token never reaches
 * the handler, and the caller identity comes from the verified `sub` — never from a header
 * or body the client controls.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ') || header.length <= 'Bearer '.length) {
      throw new ProblemDetailsException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHORIZED',
        'Authentication required',
        'Provide a valid Bearer access token in the Authorization header.',
      );
    }

    request.auth = this.tokens.verify(header.slice('Bearer '.length));
    return true;
  }
}

/** Injects the verified claims set by JwtAuthGuard. Only valid on routes guarded by it. */
export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): AuthClaims => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.auth) {
    throw new ProblemDetailsException(
      HttpStatus.UNAUTHORIZED,
      'UNAUTHORIZED',
      'Authentication required',
      'This route requires JwtAuthGuard.',
    );
  }
  return request.auth;
});
