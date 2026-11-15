/*
 * Estimaciones de ayuda para crear vuelos, calculadas solo en el navegador (el servidor no las conoce).
 * Son sugerencias: la persona puede ignorarlas o cambiarlas.
 */

/** Coordenadas [latitud, longitud] de los aeropuertos del seed. Un aeropuerto fuera de la tabla no tiene estimación. */
export const AIRPORT_COORDS: Readonly<Record<string, readonly [number, number]>> = {
  UIO: [-0.1292, -78.3575],
  GYE: [-2.1574, -79.8836],
  CUE: [-2.8895, -78.9844],
  LOH: [-3.9959, -79.3719],
  MEC: [-0.9461, -80.6788],
  ESM: [0.9785, -79.6266],
  LGQ: [0.0930, -76.8675],
  OCC: [-0.4629, -76.9868],
  GPS: [-0.4538, -90.2659],
  SCY: [-0.9102, -89.6174],
  BOG: [4.7016, -74.1469],
  MDE: [6.1645, -75.4231],
  CLO: [3.5432, -76.3816],
  CTG: [10.4424, -75.5130],
  LIM: [-12.0219, -77.1143],
  CUZ: [-13.5357, -71.9388],
  PTY: [9.0714, -79.3835],
  SCL: [-33.3930, -70.7858],
  EZE: [-34.8222, -58.5358],
  GRU: [-23.4356, -46.4731],
  MIA: [25.7959, -80.2870],
  MAD: [40.4719, -3.5626],
};

const EARTH_RADIUS_KM = 6371;
const CRUISE_KMH = 800;
const GROUND_AND_CLIMB_MINUTES = 30;
const USD_PER_KM = 0.09;
const PRICE_FLOOR_USD = 55;
/** Mismo tope que el DTO del servidor. */
export const MAX_BASE_PRICE_USD = 5000;
const MIN_DURATION = 20;
const MAX_DURATION = 1500;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distancia entre dos puntos de la Tierra, en km. */
export function haversineKm(a: readonly [number, number], b: readonly [number, number]): number {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distancia entre dos aeropuertos por su código IATA, o null si falta alguno en la tabla. */
export function routeDistanceKm(origin: string, destination: string): number | null {
  const a = AIRPORT_COORDS[origin.trim().toUpperCase()];
  const b = AIRPORT_COORDS[destination.trim().toUpperCase()];
  if (!a || !b) return null;
  return haversineKm(a, b);
}

/** Duración por distancia: ~800 km/h más 30 min, redondeada a 5 min y dentro de lo que acepta el servidor. */
export function estimateDurationMinutes(origin: string, destination: string): number | null {
  const km = routeDistanceKm(origin, destination);
  if (km === null || origin.trim().toUpperCase() === destination.trim().toUpperCase()) return null;
  const minutes = Math.round(((km / CRUISE_KMH) * 60 + GROUND_AND_CLIMB_MINUTES) / 5) * 5;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, minutes));
}

/** Tarifa por distancia: ~0.09 USD/km con piso de 55 USD (calibrada con el seed), nunca sobre el tope. */
export function estimatePriceUsd(origin: string, destination: string): number | null {
  const km = routeDistanceKm(origin, destination);
  if (km === null || origin.trim().toUpperCase() === destination.trim().toUpperCase()) return null;
  return Math.min(MAX_BASE_PRICE_USD, Math.max(PRICE_FLOOR_USD, Math.round(km * USD_PER_KM)));
}

export interface RouteFlight {
  origen: string;
  destino: string;
  duracionMinutos: number;
  precioBaseUsd: number;
}

export interface PriceSuggestion {
  amount: number;
  /** Rango de los vuelos existentes de la ruta; ausente si la sugerencia sale de la distancia. */
  range?: { min: number; max: number };
  source: 'ruta' | 'distancia';
}

export interface DurationSuggestion {
  minutes: number;
  source: 'ruta' | 'distancia';
}

const sameRoute = (f: RouteFlight, origin: string, destination: string) =>
  f.origen.toUpperCase() === origin.trim().toUpperCase() && f.destino.toUpperCase() === destination.trim().toUpperCase();

const median = (values: number[]) => {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Duración de un vuelo existente de la misma ruta; si no hay, la calculada por distancia; si falta un aeropuerto, null. */
export function suggestDuration(origin: string, destination: string, existing: readonly RouteFlight[] = []): DurationSuggestion | null {
  const same = existing.filter((f) => sameRoute(f, origin, destination));
  if (same.length > 0) return { minutes: Math.round(median(same.map((f) => f.duracionMinutos))), source: 'ruta' };
  const minutes = estimateDurationMinutes(origin, destination);
  return minutes === null ? null : { minutes, source: 'distancia' };
}

/** Tarifa: mediana (y rango) de los vuelos existentes de la ruta; si no hay, por distancia; si falta un aeropuerto, null. */
export function suggestPrice(origin: string, destination: string, existing: readonly RouteFlight[] = []): PriceSuggestion | null {
  const same = existing.filter((f) => sameRoute(f, origin, destination));
  if (same.length > 0) {
    const prices = same.map((f) => f.precioBaseUsd);
    return {
      amount: Math.min(MAX_BASE_PRICE_USD, Math.round(median(prices) * 100) / 100),
      range: { min: Math.min(...prices), max: Math.max(...prices) },
      source: 'ruta',
    };
  }
  const amount = estimatePriceUsd(origin, destination);
  return amount === null ? null : { amount, source: 'distancia' };
}

/** 110 -> «1 h 50 min»; 120 -> «2 h»; 45 -> «45 min». */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
