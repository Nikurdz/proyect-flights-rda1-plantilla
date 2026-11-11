/** OAuth2 scopes of contract v2 (components.securitySchemes.PartnerOAuth2). */
export const PARTNER_SCOPES = ['flights:read', 'flights:hold', 'flights:book', 'flights:cancel', 'flights:webhooks', 'flights:ops', 'flights:admin'] as const;
export type PartnerScope = (typeof PARTNER_SCOPES)[number];

/** What a signed-in user of the platform (not a partner) may do on v2: the "BearerAuth" alternative of the contract. */
export const USER_SCOPES: PartnerScope[] = ['flights:read', 'flights:hold', 'flights:book', 'flights:cancel', 'flights:webhooks'];

/** `flights:admin` stands for every scope ("administración del acuerdo B2B y todas las operaciones"). */
export function hasScope(granted: readonly string[], required: PartnerScope): boolean {
  return granted.includes('flights:admin') || granted.includes(required);
}
