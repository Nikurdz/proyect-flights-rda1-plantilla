import type { TlsOptions } from 'node:tls';

/**
 * The TLS options for the database connection, read from the environment so the app, the migrations and the seed all
 * connect the same way. The `pg` driver derives its own mode from `sslmode` in the URL or PGSSLMODE and, since 8.16,
 * treats `require` as `verify-full`: it refuses the private certificate authority of managed services such as Aiven.
 *
 * With `DB_SSL_CA` (the provider's CA certificate, PEM) the connection is encrypted AND verified against that authority.
 * Without it nothing is overridden and the driver decides (a local Postgres without TLS keeps working).
 */
export function dbSsl(env: NodeJS.ProcessEnv = process.env): TlsOptions | undefined {
  // Railway variables often keep the PEM on one line with literal "\n": restore the line breaks.
  const ca = env.DB_SSL_CA?.replace(/\\n/g, '\n');
  return ca ? { ca, rejectUnauthorized: true } : undefined;
}
