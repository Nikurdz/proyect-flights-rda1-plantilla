import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { graphqlRequest } from '../graphql';
import type { AuditoriaSaga, AuditoriaTransaccion } from '../types';

export interface AuditoriaFiltros {
  correlationId?: string;
  tipo?: string;
  estado?: string;
  limite?: number;
}

export const TRANSACCIONES_QUERY = /* GraphQL */ `
  query AuditoriaTransacciones($correlationId: String, $tipo: String, $limite: Int) {
    auditoriaTransacciones(correlationId: $correlationId, tipo: $tipo, limite: $limite) {
      id
      eventoId
      tipo
      agregadoId
      propietarioId
      correlationId
      resumen
      ocurridoEn
    }
  }
`;

export const SAGAS_QUERY = /* GraphQL */ `
  query AuditoriaSagas($correlationId: String, $tipo: String, $estado: String, $limite: Int) {
    auditoriaSagas(correlationId: $correlationId, tipo: $tipo, estado: $estado, limite: $limite) {
      sagaId
      tipo
      referencia
      correlationId
      estado
      error
      iniciadaEn
      finalizadaEn
      pasos {
        secuencia
        nombre
        estado
        detalle
        duracionMs
      }
    }
  }
`;

export const AUDIT_LIMIT = 50;

/** Only the filters the person filled in travel to the API (a blank string would be a filter by «nothing»). */
export function compactVariables(filters: AuditoriaFiltros): Record<string, unknown> {
  return Object.fromEntries(Object.entries({ ...filters, limite: filters.limite ?? AUDIT_LIMIT }).filter(([, v]) => v !== undefined && v !== ''));
}

export function useAuditoriaTransacciones(filtros: AuditoriaFiltros, ownerId?: string) {
  const variables = compactVariables({ correlationId: filtros.correlationId, tipo: filtros.tipo, limite: filtros.limite });
  return useQuery({
    queryKey: ['admin-auditoria-transacciones', ownerId, variables],
    queryFn: async () => (await graphqlRequest<{ auditoriaTransacciones: AuditoriaTransaccion[] }>(TRANSACCIONES_QUERY, variables)).auditoriaTransacciones,
    enabled: Boolean(ownerId),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useAuditoriaSagas(filtros: AuditoriaFiltros, ownerId?: string) {
  const variables = compactVariables({ correlationId: filtros.correlationId, tipo: filtros.tipo, estado: filtros.estado, limite: filtros.limite });
  return useQuery({
    queryKey: ['admin-auditoria-sagas', ownerId, variables],
    queryFn: async () => (await graphqlRequest<{ auditoriaSagas: AuditoriaSaga[] }>(SAGAS_QUERY, variables)).auditoriaSagas,
    enabled: Boolean(ownerId),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
