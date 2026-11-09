/**
 * Time zone of each airport the network serves, so flight times are shown in the local time of the
 * place (what a traveller expects on a ticket). The API stores instants in UTC and the order views
 * only carry the IATA code; an unknown code falls back to UTC.
 */
const TIME_ZONES: Record<string, string> = {
  BOG: 'America/Bogota',
  MDE: 'America/Bogota',
  CLO: 'America/Bogota',
  CTG: 'America/Bogota',
  UIO: 'America/Guayaquil',
  GYE: 'America/Guayaquil',
  CUE: 'America/Guayaquil',
  GPS: 'Pacific/Galapagos',
  LIM: 'America/Lima',
  CUZ: 'America/Lima',
  SCL: 'America/Santiago',
  EZE: 'America/Argentina/Buenos_Aires',
  AEP: 'America/Argentina/Buenos_Aires',
  GRU: 'America/Sao_Paulo',
  GIG: 'America/Sao_Paulo',
  MVD: 'America/Montevideo',
  ASU: 'America/Asuncion',
  LPB: 'America/La_Paz',
  PTY: 'America/Panama',
  MEX: 'America/Mexico_City',
  CUN: 'America/Cancun',
  MIA: 'America/New_York',
  JFK: 'America/New_York',
  MAD: 'Europe/Madrid',
  // Ecuador: continental airports (America/Guayaquil) and Galápagos (SCY joins GPS).
  SCY: 'Pacific/Galapagos',
  ...Object.fromEntries(
    ['LOH', 'MEC', 'ESM', 'LTX', 'SNC', 'ETR', 'TUA', 'ATF', 'BHA', 'OCC', 'MRR', 'XMS', 'MCH', 'LGQ', 'PVO', 'PYO', 'WSE', 'PTZ', 'SUQ', 'TSC', 'TPC', 'TNW', 'TPN', 'JIP'].map((c) => [c, 'America/Guayaquil']),
  ),
};

function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Completes the map with the zones the API reports for the catalogue (so an airport an admin created is
 * not shown in UTC). Known entries and invalid zones are left untouched.
 */
export function registerTimeZones(airports: ReadonlyArray<{ iata?: string | null; zonaHoraria?: string | null }>): void {
  for (const a of airports) {
    const code = a.iata?.toUpperCase();
    if (!code || !a.zonaHoraria || TIME_ZONES[code] || !isValidZone(a.zonaHoraria)) continue;
    TIME_ZONES[code] = a.zonaHoraria;
  }
}

export function timeZoneOf(iata?: string | null): string {
  return (iata && TIME_ZONES[iata.toUpperCase()]) || 'UTC';
}
