import type { OpenAPIObject } from '@nestjs/swagger';
import { SWAGGER_TAGS, SWAGGER_TAG_LIST } from './common/swagger-tags';
import { buildVuelosSwaggerConfig, orderVuelosPaths } from './swagger';

describe('Swagger sections', () => {
  it('declares every tag once, in the order of a purchase, with a description', () => {
    const names = SWAGGER_TAG_LIST.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual(Object.values(SWAGGER_TAGS).sort()); // nothing declared that no controller can use, and vice versa
    expect(SWAGGER_TAG_LIST.every((t) => t.description.length > 20)).toBe(true);
    // The numbered sections come first, in order; what is not implemented goes last.
    expect(names.slice(0, 6).map((n) => n[0])).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(names.slice(-3).every((n) => n.startsWith('⛔'))).toBe(true);
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
