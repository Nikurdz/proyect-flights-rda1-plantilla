import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenService } from '../../auth/token.service';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import { hashPassword, verifyPassword } from '../../ecommerce/identidad/password.util';
import { PartnerClient } from '../../entities/partner-client.entity';
import { PARTNER_SCOPES } from './scopes';

export type OAuthErrorCode = 'invalid_request' | 'invalid_client' | 'invalid_scope' | 'unsupported_grant_type';

/** An RFC 6749 §5.2 error: the token endpoint answers `{ error, error_description }`, not problem+json. */
export class OAuthError extends Error {
  constructor(
    readonly error: OAuthErrorCode,
    readonly status: number,
    description: string,
  ) {
    super(description);
  }
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

// A hash to compare against when the client does not exist, so an unknown id costs as much as a wrong secret.
let decoy: Promise<string> | null = null;

@Injectable()
export class PartnerAuthService {
  constructor(
    @InjectRepository(PartnerClient) private readonly clients: Repository<PartnerClient>,
    private readonly tokens: TokenService,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  /** OAuth2 `client_credentials`: the partner proves who it is and gets a token limited to the scopes it asks for (or all it may use). */
  async issue(grantType: string | undefined, clientId: string | undefined, clientSecret: string | undefined, requestedScope: string | undefined): Promise<OAuthTokenResponse> {
    if (grantType !== 'client_credentials') throw new OAuthError('unsupported_grant_type', 400, 'Only client_credentials is supported.');
    if (!clientId || !clientSecret) throw new OAuthError('invalid_client', 401, 'Client authentication failed.');

    const client = await this.clients.findOneBy({ clientId });
    const valid = await verifyPassword(clientSecret, client?.secretHash ?? (await (decoy ??= hashPassword('decoy-secret'))));
    if (!client || !client.activo || !valid) throw new OAuthError('invalid_client', 401, 'Client authentication failed.');

    const allowed = client.scopes.split(' ').filter((s) => (PARTNER_SCOPES as readonly string[]).includes(s));
    const requested = requestedScope ? requestedScope.split(' ').filter(Boolean) : allowed;
    const outside = requested.filter((s) => !allowed.includes(s));
    if (outside.length > 0) throw new OAuthError('invalid_scope', 400, `Scope not allowed for this client: ${outside.join(' ')}.`);

    const signed = this.tokens.sign({ ownerId: client.clientId, kind: 'service', roles: [], scopes: requested });
    return { access_token: signed.accessToken, token_type: 'Bearer', expires_in: signed.expiresIn, scope: requested.join(' ') };
  }

  /** Creates or updates a client (used by the seed; the secret is stored hashed). */
  async upsert(clientId: string, secret: string, scopes: readonly string[] = PARTNER_SCOPES): Promise<void> {
    if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(clientId)) throw new Error('A partner client id has 3-30 characters: lowercase letters, digits, - and _.');
    if (secret.length < 24) throw new Error('A partner client secret needs at least 24 characters.');
    await this.clients.save({ clientId, secretHash: await hashPassword(secret), scopes: scopes.join(' '), activo: true });
  }
}
