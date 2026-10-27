import 'reflect-metadata';
import { join } from 'node:path';
import { config } from 'dotenv';
config({ quiet: true });

import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { FieldCipher } from '../common/cifrado';
import { dbSsl, dbUrl } from '../common/db-ssl';
import { loadVuelosConfig } from '../common/vuelos-config';
import { hashPassword } from '../ecommerce/identidad/password.util';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { PartnerClient } from '../entities/partner-client.entity';
import { PARTNER_SCOPES } from '../v2/auth/scopes';
import { seedDemoScenarios, seedFlights } from './flights.seed';

// Entities are discovered by glob so every sub-domain of this module is covered without a
// list to maintain. The same glob works for ts-node (.ts) and the compiled build (.js).
const dataSource = new DataSource({
  type: 'postgres',
  url: dbUrl(process.env.DATABASE_URL),
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  ssl: dbSsl(),
  synchronize: false, // the schema comes from `start:dev` (synchronize) or the migrations
});

async function main(): Promise<void> {
  await dataSource.initialize();

  const flights = await seedFlights(dataSource);
  console.log(`Flights: ${flights.families} fare families; flights created this run: ${flights.flights}.`);

  // Flights left full on purpose for the demo; SEED_DEMO_SCENARIOS=false turns it off.
  if (process.env.SEED_DEMO_SCENARIOS !== 'false') {
    // The synthetic passengers are encrypted like real ones, with the same key the application derives at boot.
    FieldCipher.configure(loadVuelosConfig(new ConfigService({ ...process.env })).dataEncryptionKey);
    console.log(`Demo scenarios: flights left sold out or nearly full this run: ${await seedDemoScenarios(dataSource)}.`);
  }

  // An administrator is created only when explicitly configured; there is no default account.
  const adminCorreo = process.env.ADMIN_EMAIL;
  const adminContrasena = process.env.ADMIN_PASSWORD;
  if ((adminCorreo && !adminContrasena) || (!adminCorreo && adminContrasena)) {
    throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD, or neither.');
  }
  if (adminContrasena && adminContrasena.length < 12) {
    throw new Error('ADMIN_PASSWORD must have at least 12 characters.');
  }
  const ecommerce = await seedEcommerce(dataSource, adminCorreo && adminContrasena ? { correo: adminCorreo, contrasena: adminContrasena } : undefined);
  console.log(`E-commerce created this run: ${JSON.stringify(ecommerce)}.`);

  // The integrator of contract v2 (Booking Prototipo) signs in with client_credentials: created only when configured, never with a default secret.
  const partnerId = process.env.PARTNER_CLIENT_ID ?? 'booking-prototipo';
  const partnerSecret = process.env.PARTNER_CLIENT_SECRET;
  if (partnerSecret) {
    if (partnerSecret.length < 24) throw new Error('PARTNER_CLIENT_SECRET must have at least 24 characters.');
    if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(partnerId)) throw new Error('PARTNER_CLIENT_ID must be 3-30 characters: lowercase letters, digits, - and _.');
    await dataSource.getRepository(PartnerClient).save({ clientId: partnerId, secretHash: await hashPassword(partnerSecret), scopes: PARTNER_SCOPES.join(' '), activo: true });
    console.log(`Partner client "${partnerId}" is ready for /api/v2/oauth2/token.`);
  }

  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
