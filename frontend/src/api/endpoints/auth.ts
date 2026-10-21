import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { startSession } from '../../lib/auth-actions';
import { setStoredToken } from '../../lib/storage';
import type { ClienteViewDto, LoginDto, PreferenciasDto, RegistroClienteDto, TokenViewDto } from '../types';

/** Signs in and starts a clean session: nothing cached from before is kept. */
export async function login(dto: LoginDto): Promise<TokenViewDto> {
  const res = await apiClient<TokenViewDto>('auth/login', {
    method: 'POST',
    body: JSON.stringify(dto),
    skipAuth: true,
  });
  if (res.accessToken) {
    startSession(res.accessToken);
  }
  return res;
}

/** A guest session lets someone buy without an account. */
export async function crearSesionInvitado(): Promise<TokenViewDto> {
  const res = await apiClient<TokenViewDto>('auth/invitado', {
    method: 'POST',
    skipAuth: true,
  });
  if (res.accessToken) {
    setStoredToken(res.accessToken);
  }
  return res;
}

export async function verificarCorreo(token: string): Promise<void> {
  return apiClient<void>('auth/verificar-correo', {
    method: 'POST',
    body: JSON.stringify({ token }),
    skipAuth: true,
  });
}

/** Everything the registration form collects; the market is always the single USD market. */
export type RegistroInput = Omit<RegistroClienteDto, 'mercado' | 'consentimientoMarketing'> & {
  consentimientoMarketing?: boolean;
};

export async function registrarCliente(input: RegistroInput): Promise<ClienteViewDto> {
  const body: RegistroClienteDto = { mercado: 'ec', consentimientoMarketing: false, ...input };
  return apiClient<ClienteViewDto>('clientes', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export async function obtenerPerfil(): Promise<ClienteViewDto> {
  return apiClient<ClienteViewDto>('clientes/me');
}

export async function actualizarPreferencias(dto: PreferenciasDto): Promise<ClienteViewDto> {
  return apiClient<ClienteViewDto>('clientes/me/preferencias', {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function usePerfil(enabled: boolean = true, ownerId?: string) {
  return useQuery({
    queryKey: ['perfil-me', ownerId],
    queryFn: obtenerPerfil,
    enabled,
    retry: false,
  });
}
