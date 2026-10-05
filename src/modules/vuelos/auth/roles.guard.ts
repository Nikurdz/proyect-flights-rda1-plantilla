import { CanActivate, ExecutionContext, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProblemDetailsException } from '../common/problem-details.exception';
import type { AuthenticatedRequest } from './jwt-auth.guard';

const ROLES_KEY = 'vuelos:roles';

/** Restricts a route to callers holding at least one of the roles. Use after JwtAuthGuard. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;

    const auth = context.switchToHttp().getRequest<AuthenticatedRequest>().auth;
    if (!auth || !required.some((role) => auth.roles.includes(role))) {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Insufficient role', 'This operation is restricted to administrators.');
    }
    return true;
  }
}
