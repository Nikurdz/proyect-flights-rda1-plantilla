import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACCIONES, COMPONENTES, ENTIDADES_ADMIN, EVENTOS, LLAMADAS, PASOS_SAGA, enlaceDeEvento, entradaDe, esRuidoDeProveedor } from './topologia';

const root = join(__dirname, '..', '..', '..', '..');
const ids = new Set<string>(COMPONENTES.map((c) => c.id));

describe('topologia: the map the traceability flow is drawn from', () => {
  it('has an entry for every event type that has a contract (a new event forces a new entry)', () => {
    const types = [...new Set(readdirSync(join(root, 'contracts', 'eventos')).filter((f) => f.endsWith('.schema.json')).map((f) => f.replace(/\.v\d+\.schema\.json$/, '')))];
    const missing = types.filter((t) => !esRuidoDeProveedor(t) && !EVENTOS[t]);
    expect(missing).toEqual([]);
  });

  it('has an entry for every step the purchase saga records', () => {
    const source = readFileSync(join(__dirname, '..', 'ecommerce', 'ordenes', 'compras.service.ts'), 'utf8');
    const steps = [...source.matchAll(/traza\.paso\('([A-Z_]+)'/g)].map((m) => m[1]);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.filter((s) => !PASOS_SAGA[s])).toEqual([]);
  });

  it('only connects components that exist, and never mentions providers', () => {
    const links = [...Object.values(EVENTOS), ...Object.values(PASOS_SAGA), ...Object.values(LLAMADAS), ...Object.values(ACCIONES)];
    for (const link of links) {
      expect(ids.has(link.origen)).toBe(true);
      expect(ids.has(link.destino)).toBe(true);
    }
    for (const destino of Object.values(ENTIDADES_ADMIN)) expect(ids.has(destino)).toBe(true);
    expect(COMPONENTES.some((c) => /prove/i.test(c.id + c.etiqueta))).toBe(false);
  });

  it('classifies provider noise and the entry node of each actor', () => {
    expect(esRuidoDeProveedor('proveedor.salud')).toBe(true);
    expect(esRuidoDeProveedor('ReservaExternaFallida')).toBe(true);
    expect(esRuidoDeProveedor('booking.cancelled')).toBe(false);
    expect(esRuidoDeProveedor('x', 'proveedor')).toBe(true);
    expect(entradaDe('PARTNER')).toBe('booking');
    expect(entradaDe('ADMIN')).toBe('admin');
    expect(entradaDe('GUEST')).toBe('web');
    expect(enlaceDeEvento('llamada.stock_push')).toEqual({ origen: 'api', destino: 'booking' });
  });
});
