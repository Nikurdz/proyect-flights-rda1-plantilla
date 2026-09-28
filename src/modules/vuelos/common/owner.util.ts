const DEV_OWNER_ID = 'dev-owner';

/**
 * Decodes (never verifies) a Bearer JWT's `sub` claim. There is no Identity Provider in
 * this phase (RDA1) to verify a signature against — this is a documented placeholder,
 * to be replaced with real verification once RDA2 wires up authentication across teams.
 */
export function resolveOwnerId(authorizationHeader?: string): string {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return DEV_OWNER_ID;
  }

  const token = authorizationHeader.slice('Bearer '.length);
  const payloadSegment = token.split('.')[1];
  if (!payloadSegment) {
    return DEV_OWNER_ID;
  }

  try {
    const json = Buffer.from(payloadSegment, 'base64url').toString('utf-8');
    const payload = JSON.parse(json) as { sub?: string };
    return payload.sub ?? DEV_OWNER_ID;
  } catch {
    return DEV_OWNER_ID;
  }
}
