import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';

export type TokenKind = 'customer' | 'guest' | 'service';

export interface AuthClaims {
  /** Subject: the customer id, a guest id (guest:<uuid>) or a service client id. */
  ownerId: string;
  kind: TokenKind;
  roles: string[];
}

export interface SignedToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/**
 * Signs and verifies the HS256 access tokens. There is no external Identity Provider in
 * RDA1, so the identity service in this module is the issuer and this shared secret is the
 * trust anchor; moving to a real OIDC provider means swapping verify() for a JWKS
 * verification and nothing else.
 */
@Injectable()
export class TokenService {
  constructor(@Inject(VUELOS_CONFIG) private readonly config: VuelosConfig) {}

  sign(claims: AuthClaims): SignedToken {
    const accessToken = jwt.sign(
      { kind: claims.kind, roles: claims.roles },
      this.config.jwtSecret,
      { algorithm: 'HS256', subject: claims.ownerId, expiresIn: this.config.jwtTtlSeconds, issuer: 'vuelos-identity' },
    );
    return { accessToken, tokenType: 'Bearer', expiresIn: this.config.jwtTtlSeconds };
  }

  verify(token: string): AuthClaims {
    try {
      // algorithms is pinned so a token cannot downgrade itself to "none" or switch alg.
      const payload = jwt.verify(token, this.config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'vuelos-identity',
      }) as jwt.JwtPayload;

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new Error('token has no subject');
      }
      const kind: TokenKind = payload.kind === 'guest' || payload.kind === 'service' ? payload.kind : 'customer';
      const roles = Array.isArray(payload.roles) ? payload.roles.filter((r): r is string => typeof r === 'string') : [];
      return { ownerId: payload.sub, kind, roles };
    } catch {
      throw new ProblemDetailsException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHORIZED',
        'Invalid or expired access token',
        'Provide a valid Bearer access token in the Authorization header.',
      );
    }
  }
}
