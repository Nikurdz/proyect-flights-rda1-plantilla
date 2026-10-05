import 'reflect-metadata';
import { join } from 'node:path';
import { config } from 'dotenv';
config({ quiet: true });

import { DataSource } from 'typeorm';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { seedFlights } from './flights.seed';

// Entities are discovered by glob so every sub-domain of this module is covered without a
// list to maintain. The same glob works for ts-node (.ts) and the compiled build (.js).
const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  synchronize: false, // the schema comes from `start:dev` (synchronize) or the migrations
});

async function main(): Promise<void> {
  await dataSource.initialize();

  const flights = await seedFlights(dataSource);
  console.log(`Flights: ${flights.families} fare families; flights created this run: ${flights.flights}.`);

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

  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
