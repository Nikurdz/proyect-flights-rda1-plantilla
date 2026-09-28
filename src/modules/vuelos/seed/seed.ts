import 'reflect-metadata';
import { config } from 'dotenv';
config();

import { DataSource } from 'typeorm';
import { FareFamily } from '../entities/fare-family.entity';
import { Vuelo } from '../entities/vuelo.entity';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Vuelo, FareFamily],
  synchronize: false, // the app's own TypeOrmModule.forRootAsync (synchronize: true) creates the schema on first boot
});

const FARE_FAMILIES = [
  {
    code: 'BASIC',
    name: 'Basic',
    carryOnKg: 0,
    checkedBags: 0,
    changeable: false,
    refundable: false,
    seatSelectionIncluded: false,
    upgradeEligible: false,
    accrualFactor: 0.5, // RN-11: reduced accrual on the most restrictive economy family
    priceMultiplier: 1.0,
  },
  {
    code: 'LIGHT',
    name: 'Light',
    carryOnKg: 10,
    checkedBags: 0,
    changeable: false,
    refundable: false,
    seatSelectionIncluded: false,
    upgradeEligible: true,
    accrualFactor: 1.0,
    priceMultiplier: 1.15,
  },
  {
    code: 'FULL',
    name: 'Full',
    carryOnKg: 10,
    checkedBags: 1,
    changeable: true,
    refundable: true,
    seatSelectionIncluded: true,
    upgradeEligible: true,
    accrualFactor: 1.0,
    priceMultiplier: 1.35,
  },
];

function daysFromNow(days: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// Curated direct flights covering the SRS's own evidence route (BOG-SCL) plus a few more
// — a deliberate, documented reduction, not an attempt at a real schedule.
const VUELOS = [
  {
    aerolinea: 'LATAM Airlines',
    codigoAerolinea: 'LA',
    codigoVuelo: 'LA800',
    origenIATA: 'BOG',
    destinoIATA: 'SCL',
    fechaSalida: daysFromNow(15, 8),
    fechaLlegada: daysFromNow(15, 13),
    precioBase: 320,
    asientosDisponibles: 42,
    durationMinutes: 300,
  },
  {
    aerolinea: 'LATAM Airlines',
    codigoAerolinea: 'LA',
    codigoVuelo: 'LA1500',
    origenIATA: 'BOG',
    destinoIATA: 'SCL',
    fechaSalida: daysFromNow(15, 16),
    fechaLlegada: daysFromNow(15, 21),
    precioBase: 298,
    asientosDisponibles: 5,
    durationMinutes: 300,
  },
  {
    aerolinea: 'LATAM Airlines',
    codigoAerolinea: 'LA',
    codigoVuelo: 'LA801',
    origenIATA: 'SCL',
    destinoIATA: 'BOG',
    fechaSalida: daysFromNow(22, 9),
    fechaLlegada: daysFromNow(22, 14),
    precioBase: 335,
    asientosDisponibles: 38,
    durationMinutes: 300,
  },
  {
    aerolinea: 'Avianca',
    codigoAerolinea: 'AV',
    codigoVuelo: 'AV123',
    origenIATA: 'BOG',
    destinoIATA: 'MDE',
    fechaSalida: daysFromNow(15, 10),
    fechaLlegada: daysFromNow(15, 11),
    precioBase: 95,
    asientosDisponibles: 60,
    durationMinutes: 55,
  },
  {
    aerolinea: 'Avianca',
    codigoAerolinea: 'AV',
    codigoVuelo: 'AV456',
    origenIATA: 'BOG',
    destinoIATA: 'LIM',
    fechaSalida: daysFromNow(15, 14),
    fechaLlegada: daysFromNow(15, 17),
    precioBase: 210,
    asientosDisponibles: 50,
    durationMinutes: 150,
  },
];

async function main(): Promise<void> {
  await dataSource.initialize();

  const fareFamilyRepo = dataSource.getRepository(FareFamily);
  for (const family of FARE_FAMILIES) {
    const exists = await fareFamilyRepo.findOne({ where: { code: family.code } });
    if (!exists) {
      await fareFamilyRepo.save(fareFamilyRepo.create(family));
    }
  }

  const vueloRepo = dataSource.getRepository(Vuelo);
  for (const vuelo of VUELOS) {
    const exists = await vueloRepo.findOne({
      where: { codigoVuelo: vuelo.codigoVuelo, fechaSalida: vuelo.fechaSalida },
    });
    if (!exists) {
      await vueloRepo.save(vueloRepo.create(vuelo));
    }
  }

  console.log(`Seeded ${FARE_FAMILIES.length} fare families and ${VUELOS.length} flights.`);
  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
