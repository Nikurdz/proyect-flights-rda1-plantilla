import { Body, Controller, Headers, HttpCode, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { OAuthError, PartnerAuthService } from './partner-auth.service';

/**
 * Token endpoint of PartnerOAuth2 (`tokenUrl: /oauth2/token` of the v2 contract, i.e. /api/v2/oauth2/token).
 * Accepts application/x-www-form-urlencoded (the standard) or JSON, with the client credentials in the body or
 * in an HTTP Basic header. Errors use the RFC 6749 body.
 */
@Controller({ path: 'oauth2', version: '2' })
@ApiExcludeController()
export class OAuth2Controller {
  constructor(private readonly auth: PartnerAuthService) {}

  @Post('token')
  @HttpCode(200)
  async token(@Body() body: Record<string, string> | undefined, @Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    let clientId = body?.client_id;
    let clientSecret = body?.client_secret;
    if (authorization?.startsWith('Basic ')) {
      const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator > 0) {
        clientId = decodeURIComponent(decoded.slice(0, separator));
        clientSecret = decodeURIComponent(decoded.slice(separator + 1));
      }
    }
    try {
      return await this.auth.issue(body?.grant_type, clientId, clientSecret, body?.scope);
    } catch (error) {
      if (error instanceof OAuthError) {
        res.status(error.status);
        if (error.status === 401) res.setHeader('WWW-Authenticate', 'Basic realm="vuelos"');
        return { error: error.error, error_description: error.message };
      }
      throw error;
    }
  }
}
