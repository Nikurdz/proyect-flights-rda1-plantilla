import type { OpenAPIObject } from '@nestjs/swagger';
import { SWAGGER_TAGS, SWAGGER_TAG_LIST } from './common/swagger-tags';
import { buildVuelosSwaggerConfig, orderVuelosPaths } from './swagger';

describe('Swagger sections', () => {
  it('declares every tag once, in the order of a purchase, with a description', () => {
    const names = SWAGGER_TAG_LIST.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual(Object.values(SWAGGER_TAGS).sort()); // nothing declared that no controller can use, and vice versa
    expect(SWAGGER_TAG_LIST.every((t) => t.description.length > 20)).toBe(true);
    // Numbered in the order of a purchase: 1 to 9 one by one, then the GDS core (10) and the system section (11).
    const numbers = names.map((n) => Number(/^(\d+) ·/.exec(n)?.[1]));
    expect(numbers.every(Number.isInteger)).toBe(true);
    expect(numbers.slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
    // Nothing of the contract is left inactive, so there is no 'not implemented' section any more.
    expect(names.some((n) => /no implementado|⛔/i.test(n))).toBe(false);
    expect(SWAGGER_TAG_LIST.some((t) => /501|sin implementar/i.test(t.description))).toBe(false);
  });

  it('puts the declared tags into the document in that order', () => {
    const config = buildVuelosSwaggerConfig();
    expect(config.tags?.map((t) => t.name)).toEqual(SWAGGER_TAG_LIST.map((t) => t.name));
    expect(config.info.description).toContain('Recorrido de una compra');
  });
});

describe('orderVuelosPaths', () => {
  const doc = (paths: Record<string, unknown>) => ({ paths }) as unknown as OpenAPIObject;

  it('orders the "Paso" operations first and by step, then the rest by path', () => {
    const document = doc({
      '/ofertas/{id}': { get: { summary: 'Consultar una oferta' }, delete: { summary: 'Descartar' } },
      '/ofertas/{id}/facturacion': { put: { summary: 'Paso 3C · Registrar los datos de facturación' } },
      '/admin/ordenes': { get: { summary: 'Listar órdenes (ADMIN)' } },
      '/ofertas': { post: { summary: 'Paso 3A · Armar una oferta' } },
      '/ofertas/{id}/pasajeros': { put: { summary: 'Paso 3B · Registrar pasajeros' } },
      '/ofertas/{id}/asientos': { get: { summary: 'Paso 3B+ · Mapa de asientos (opcional)' } },
    });
    orderVuelosPaths(document);
    expect(Object.keys(document.paths)).toEqual(['/ofertas', '/ofertas/{id}/pasajeros', '/ofertas/{id}/asientos', '/ofertas/{id}/facturacion', '/admin/ordenes', '/ofertas/{id}']);
  });

  it('keeps every route and its operations', () => {
    const paths = { '/b': { get: { summary: 'B' } }, '/a': { post: { summary: 'Paso 1A · A' } } };
    const document = doc(JSON.parse(JSON.stringify(paths)));
    orderVuelosPaths(document);
    expect(Object.keys(document.paths).sort()).toEqual(['/a', '/b']);
    expect(document.paths['/b']).toEqual(paths['/b']);
  });
});
