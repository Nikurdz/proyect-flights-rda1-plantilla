/**
 * Which part of the platform this process runs. Production (Azure) never sets `SERVICE_ROLE`, so it is the `monolith`:
 * every subscriber and every job, exactly as before. In the per-microservice containers (docker-compose.microservicios.yml):
 *
 *   api             the core: sales, holds, orders, payments, partner API, stock push and its own jobs. The satellites'
 *                   domains (audit trail, notifications, webhooks) are NOT registered here: their events reach them
 *                   through the broker (RabbitMQ).
 *   auditoria       the audit trail consumer (`auditoria_transacciones`) and its retention job.
 *   notificaciones  the consumer that turns events into messages (`ecom_notificaciones`).
 *   webhooks        the consumer that queues webhook deliveries and the `vuelos_outbox` feed, plus the dispatcher job.
 *
 * Each subscriber or job asks `runsDomain(<domain>)` (a satellite domain) or `runsCore()` (the core's own work) when it
 * starts. The role is read when asked (not at import), so a test can change `process.env.SERVICE_ROLE`.
 */
export const SERVICE_ROLES = ['monolith', 'api', 'auditoria', 'notificaciones', 'webhooks'] as const;
export type ServiceRole = (typeof SERVICE_ROLES)[number];

/** The domains a satellite can own. */
export type SatelliteDomain = Exclude<ServiceRole, 'monolith' | 'api'>;

/** `monolith` when unset or blank; an unknown value is a readable error (boot fails through `loadVuelosConfig`). */
export function parseServiceRole(raw: string | undefined | null): ServiceRole {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '') return 'monolith';
  if ((SERVICE_ROLES as readonly string[]).includes(value)) return value as ServiceRole;
  throw new Error(`SERVICE_ROLE="${raw}" is invalid: expected one of ${SERVICE_ROLES.join(', ')}`);
}

export function serviceRole(env: NodeJS.ProcessEnv = process.env): ServiceRole {
  return parseServiceRole(env.SERVICE_ROLE);
}

/** True in the monolith and in the satellite that owns the domain. */
export function runsDomain(domain: SatelliteDomain, env: NodeJS.ProcessEnv = process.env): boolean {
  const role = serviceRole(env);
  return role === 'monolith' || role === domain;
}

/** True in the monolith and in the `api` process: the core's subscribers, jobs and Booking bootstrap. */
export function runsCore(env: NodeJS.ProcessEnv = process.env): boolean {
  const role = serviceRole(env);
  return role === 'monolith' || role === 'api';
}
