// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../../src/lib/session', () => ({
  useSession: () => ({ kind: 'customer', ownerId: 'cust-1', roles: ['CUSTOMER'], isAdmin: false, expiresAt: Date.now() + 3_600_000 }),
  getSession: () => ({ kind: 'customer', ownerId: 'cust-1' }),
}));

import { apiClient } from '../../src/api/client';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { ExperienceDetailPage } from '../../src/features/experiences/ExperienceDetailPage';

const mocked = vi.mocked(apiClient);

const experiencia = {
  id: 'exp-1',
  proveedor: 'Atracciones Quito',
  tipo: 'TOUR',
  nombre: 'Tour del Centro Histórico',
  descripcion: 'Recorrido a pie por el centro.',
  duracion: '3 horas',
  precio: { moneda: 'USD', monto: '25.50' },
  imagenUrl: null,
  cancelacionGratis: true,
  categorias: ['Cultura'],
};

const reserva = {
  id: 'res-1',
  estado: 'CONFIRMADA',
  experiencia: { id: 'exp-1', nombre: 'Tour del Centro Histórico', proveedor: 'Atracciones Quito' },
  fecha: '2999-01-15',
  hora: null,
  cantidad: 2,
  total: { moneda: 'USD', monto: '51.00' },
  referenciaProveedor: 'PRV-123',
  factura: 'FAC-ABCDEFGHIJ',
  motivo: null,
  cancelacionGratis: true,
  creadaEn: '2026-10-25T10:00:00.000Z',
};

type Handler = (url: string, init?: RequestInit) => unknown;
let reservar: Handler;

beforeEach(() => {
  mocked.mockReset();
  reservar = () => reserva;
  mocked.mockImplementation((async (url: string, init?: RequestInit) => {
    if (url === 'experiencias/exp-1' && !init?.method) return experiencia;
    if (url === 'mercados/ec') return { identificacionesFiscales: [{ tipo: 'CEDULA', etiqueta: 'Cédula de Identidad', patron: '\\d{10}' }, { tipo: 'RUC', etiqueta: 'RUC', patron: '\\d{13}' }] };
    if (url === 'clientes/me') return { nombres: 'Ana', apellidos: 'Paz', correo: 'ana@example.com' };
    if (url === 'experiencias/exp-1/reservas') return reservar(url, init);
    return {};
  }) as never);
});
afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/experiencias/exp-1']}>
        <Routes>
          <Route path="/experiencias/:id" element={<ExperienceDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const reservarCalls = () => mocked.mock.calls.filter(([url]) => url === 'experiencias/exp-1/reservas');

async function fillForm() {
  const form = await screen.findByRole('form', { name: 'Reservar experiencia' });
  await waitFor(() => expect((within(form).getByLabelText('Nombre completo') as HTMLInputElement).value).toBe('Ana Paz'));
  const type = (label: string, value: string) => fireEvent.change(within(form).getByLabelText(label), { target: { value } });
  type('Fecha', '2999-01-15');
  type('Personas', '2');
  type('Número de identificación', '1712345678');
  type('Nombre o razón social', 'Ana Paz');
  type('Dirección fiscal', 'Av. Amazonas 123');
  fireEvent.click(within(form).getByRole('button', { name: 'Ver tarjetas de prueba' }));
  fireEvent.click(within(form).getByRole('button', { name: /4111 1111 1111 1111/ }));
  return form;
}

describe('Experience reservation', () => {
  it('shows the experience and prefills a signed-in customer', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Tour del Centro Histórico' })).toBeTruthy();
    expect(screen.getByText('Cancelación gratuita')).toBeTruthy();
    const form = await screen.findByRole('form', { name: 'Reservar experiencia' });
    await waitFor(() => expect((within(form).getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('ana@example.com'));
    expect(within(form).getByText('$25.50', { selector: 'span.text-2xl' })).toBeTruthy();
  });

  it('updates the estimated total with the number of people', async () => {
    renderPage();
    const form = await screen.findByRole('form', { name: 'Reservar experiencia' });
    fireEvent.change(within(form).getByLabelText('Personas'), { target: { value: '3' } });
    expect(await within(form).findByText('$76.50')).toBeTruthy();
  });

  it('does not send anything until the form and the card are valid', async () => {
    renderPage();
    const form = await screen.findByRole('form', { name: 'Reservar experiencia' });
    fireEvent.click(within(form).getByRole('button', { name: /Pagar y reservar/ }));
    expect(await within(form).findByText('Elige la fecha de la experiencia.')).toBeTruthy();
    expect(within(form).getByText('Ingresa el número de tu tarjeta.')).toBeTruthy();
    expect(reservarCalls()).toHaveLength(0);
  });

  it('pays with a gateway token (never the card number) and shows the invoice', async () => {
    renderPage();
    const form = await fillForm();
    fireEvent.click(within(form).getByRole('button', { name: /Pagar y reservar/ }));
    expect(await screen.findByRole('heading', { name: '¡Reserva realizada!' })).toBeTruthy();
    expect(screen.getByText('FAC-ABCDEFGHIJ')).toBeTruthy();
    expect(screen.getByText('PRV-123')).toBeTruthy();

    const [, init] = reservarCalls()[0] as [string, RequestInit & { idempotencyKey?: string }];
    expect(init.method).toBe('POST');
    expect(init.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const body = JSON.parse(init.body as string);
    expect(body.medio).toEqual({ tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'VISA' });
    expect(body).toMatchObject({ fecha: '2999-01-15', cantidad: 2, nombre: 'Ana Paz', correo: 'ana@example.com' });
    expect(body.facturacion).toEqual({ tipoIdentificacion: 'CEDULA', numeroIdentificacion: '1712345678', razonSocial: 'Ana Paz', direccion: 'Av. Amazonas 123', pais: 'EC' });
    expect(JSON.stringify(body)).not.toContain('4111');
    expect(screen.queryByText(/no admite cancelación gratuita/)).toBeNull();
  });

  it('tells the person in the result when the confirmed booking cannot be cancelled for free', async () => {
    reservar = () => ({ ...reserva, cancelacionGratis: false });
    renderPage();
    const form = await fillForm();
    fireEvent.click(within(form).getByRole('button', { name: /Pagar y reservar/ }));
    await screen.findByRole('heading', { name: '¡Reserva realizada!' });
    expect(screen.getByText(/Esta experiencia no admite cancelación gratuita/)).toBeTruthy();
  });

  it('checks the tax id against the pattern of the chosen type before paying', async () => {
    renderPage();
    const form = await fillForm();
    fireEvent.change(within(form).getByLabelText('Número de identificación'), { target: { value: '12345' } });
    fireEvent.click(within(form).getByRole('button', { name: /Pagar y reservar/ }));
    expect(await within(form).findByText('El número no corresponde al tipo de identificación elegido.')).toBeTruthy();
    expect(reservarCalls()).toHaveLength(0);
  });

  it('uses a NEW Idempotency-Key after a declined payment, and tells the person nothing was charged', async () => {
    reservar = () => {
      throw new ProblemDetailsError({ status: 402, code: 'PAYMENT_DECLINED' });
    };
    renderPage();
    const form = await fillForm();
    fireEvent.click(within(form).getByRole('button', { name: /Pagar y reservar/ }));
    expect(await screen.findByText(/El banco rechazó el pago/)).toBeTruthy();

    reservar = () => reserva;
    // The security code is wiped after a failed payment: type it again.
    fireEvent.change(within(form).getByLabelText('Código de seguridad'), { target: { value: '123' } });
    fireEvent.click(within(form).getByRole('button', { name: /Pagar y reservar/ }));
    expect(await screen.findByRole('heading', { name: '¡Reserva realizada!' })).toBeTruthy();
    const keys = reservarCalls().map(([, init]) => (init as { idempotencyKey?: string }).idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('REUSES the key to retry the same request after a network failure (never charges twice)', async () => {
    reservar = () => {
      throw new ProblemDetailsError({ status: 503, code: 'SERVICE_UNAVAILABLE' });
    };
    renderPage();
    const form = await fillForm();
    fireEvent.click(within(form).getByRole('button', { name: /Pagar y reservar/ }));
    await screen.findByText(/El servicio no responde por ahora/);

    reservar = () => reserva;
    fireEvent.change(within(form).getByLabelText('Código de seguridad'), { target: { value: '123' } });
    fireEvent.click(within(form).getByRole('button', { name: /Pagar y reservar/ }));
    await screen.findByRole('heading', { name: '¡Reserva realizada!' });
    const keys = reservarCalls().map(([, init]) => (init as { idempotencyKey?: string }).idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
  });

  it('explains a compensated reservation: the provider failed and nothing was charged', async () => {
    reservar = () => {
      throw new ProblemDetailsError({ status: 502, code: 'EXTERNAL_RESERVATION_FAILED_COMPENSATED' });
    };
    renderPage();
    const form = await fillForm();
    fireEvent.click(within(form).getByRole('button', { name: /Pagar y reservar/ }));
    expect(await screen.findByText(/no pudo confirmar la experiencia y no se te cobró nada/)).toBeTruthy();
  });

  it('on PRICE_CHANGED reloads the experience and invites to review the total', async () => {
    reservar = () => {
      throw new ProblemDetailsError({ status: 409, code: 'PRICE_CHANGED' });
    };
    renderPage();
    const form = await fillForm();
    const loadsBefore = mocked.mock.calls.filter(([url]) => url === 'experiencias/exp-1').length;
    fireEvent.click(within(form).getByRole('button', { name: /Pagar y reservar/ }));
    expect(await screen.findByText(/El precio de la experiencia cambió/)).toBeTruthy();
    await waitFor(() => expect(mocked.mock.calls.filter(([url]) => url === 'experiencias/exp-1').length).toBeGreaterThan(loadsBefore));
  });
});
