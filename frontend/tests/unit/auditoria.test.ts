import { describe, expect, it } from 'vitest';
import { cleanCorrelation, estadoFacturaLabel, formatDuration, origenFacturaLabel, pasoEstado, pasosOrdenados, sagaDuration, sagaEstado, sagaRequiereAtencion } from '../../src/lib/auditoria';
import type { AuditoriaSaga } from '../../src/api/types';

describe('saga state', () => {
  it('flags COMPENSADA and FALLIDA, and only those', () => {
    expect(sagaRequiereAtencion('COMPENSADA')).toBe(true);
    expect(sagaRequiereAtencion('FALLIDA')).toBe(true);
    expect(sagaRequiereAtencion('COMPLETADA')).toBe(false);
    expect(sagaRequiereAtencion('EN_CURSO')).toBe(false);
  });

  it('gives each state a label and a tone', () => {
    expect(sagaEstado('COMPLETADA')).toMatchObject({ tone: 'success' });
    expect(sagaEstado('EN_CURSO')).toMatchObject({ tone: 'warning' });
    expect(sagaEstado('COMPENSADA').tone).toBe('danger');
    expect(sagaEstado('FALLIDA').tone).toBe('danger');
    expect(sagaEstado('NUEVO')).toEqual({ label: 'NUEVO', tone: 'neutral' });
  });

  it('reads step states case-insensitively and keeps unknown ones visible', () => {
    expect(pasoEstado('ok').tone).toBe('success');
    expect(pasoEstado('FALLIDO').tone).toBe('danger');
    expect(pasoEstado('COMPENSADO').label).toBe('Compensado');
    expect(pasoEstado('RARO')).toEqual({ label: 'RARO', tone: 'neutral' });
  });
});

describe('durations', () => {
  it('formats milliseconds and seconds', () => {
    expect(formatDuration(850)).toBe('850 ms');
    expect(formatDuration(12400)).toBe('12,4 s');
  });

  it('measures a saga only when it finished', () => {
    expect(sagaDuration({ iniciadaEn: '2026-10-25T10:00:00.000Z', finalizadaEn: '2026-10-25T10:00:02.500Z' })).toBe(2500);
    expect(sagaDuration({ iniciadaEn: '2026-10-25T10:00:00.000Z', finalizadaEn: null })).toBeNull();
  });
});

describe('helpers', () => {
  it('orders steps by sequence', () => {
    const saga = { pasos: [{ secuencia: 3 }, { secuencia: 1 }, { secuencia: 2 }] } as unknown as Pick<AuditoriaSaga, 'pasos'>;
    expect(pasosOrdenados(saga).map((p) => p.secuencia)).toEqual([1, 2, 3]);
  });

  it('cleans the correlation filter', () => {
    expect(cleanCorrelation('   ')).toBeUndefined();
    expect(cleanCorrelation('  abc-123 ')).toBe('abc-123');
    expect(cleanCorrelation('x'.repeat(300))).toHaveLength(120);
  });

  it('labels invoices', () => {
    expect(origenFacturaLabel('ORDEN')).toBe('Vuelo');
    expect(origenFacturaLabel('EXPERIENCIA')).toBe('Experiencia');
    expect(estadoFacturaLabel('ANULADA')).toBe('Anulada');
  });
});
