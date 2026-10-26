import { describe, expect, it } from 'vitest';
import { newProviderSchema } from '../../src/features/admin/provider-schemas';

const valid = { nombre: 'Atracciones Quito', equipo: 'Equipo Atracciones', baseUrl: 'https://atracciones.example.com/api/v2', tipoServicio: 'ATRACCIONES' as const };
const messages = (input: unknown) => {
  const r = newProviderSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('newProviderSchema', () => {
  it('accepts a complete provider, with or without the /api/v2 suffix', () => {
    expect(newProviderSchema.safeParse(valid).success).toBe(true);
    expect(newProviderSchema.safeParse({ ...valid, baseUrl: 'https://atracciones.example.com' }).success).toBe(true);
  });

  it('requires name, team and URL with a clear message each', () => {
    const out = messages({ ...valid, nombre: 'A', equipo: '', baseUrl: '' });
    expect(out).toContain('Ingresa el nombre (mínimo 2 letras).');
    expect(out).toContain('Ingresa el equipo responsable (mínimo 2 letras).');
    expect(out).toContain('Ingresa la URL base del proveedor.');
  });

  it('rejects anything that is not an http(s) URL', () => {
    expect(messages({ ...valid, baseUrl: 'atracciones.example.com' }).join(' ')).toMatch(/https:\/\//);
    expect(messages({ ...valid, baseUrl: 'ftp://x.example.com' }).join(' ')).toMatch(/https:\/\//);
  });

  it('rejects an unknown service type', () => {
    expect(messages({ ...valid, tipoServicio: 'HOTELES' })).toContain('Elige el tipo de servicio.');
  });

  it('trims the text fields', () => {
    const r = newProviderSchema.parse({ ...valid, nombre: '  Atracciones  ' });
    expect(r.nombre).toBe('Atracciones');
  });
});
