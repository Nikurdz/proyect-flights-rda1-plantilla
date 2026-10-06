import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Luggage, PlaneTakeoff, ReceiptText } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { addDaysToDate, getTomorrowDateString } from '../../lib/dates';

const FEATURES = [
  {
    icon: PlaneTakeoff,
    title: 'Vuelos directos',
    text: 'Rutas sin escalas entre las principales ciudades de Sudamérica, Panamá, Estados Unidos y España.',
  },
  {
    icon: Luggage,
    title: 'Tarifas claras',
    text: 'Elige entre BASIC, LIGHT o FULL y conoce desde el inicio qué equipaje, cambios y reembolsos incluye cada una.',
  },
  {
    icon: Clock,
    title: 'Reserva retenida',
    text: 'Tus asientos quedan retenidos 15 minutos mientras completas la compra.',
  },
  {
    icon: ReceiptText,
    title: 'Precio sin sorpresas',
    text: 'Verás el desglose de tarifa e impuestos antes de pagar, siempre en dólares (USD).',
  },
];

const POPULAR_ROUTES: { from: string; to: string; fromCity: string; toCity: string }[] = [
  { from: 'BOG', to: 'MDE', fromCity: 'Bogotá', toCity: 'Medellín' },
  { from: 'UIO', to: 'GPS', fromCity: 'Quito', toCity: 'Galápagos' },
  { from: 'LIM', to: 'CUZ', fromCity: 'Lima', toCity: 'Cusco' },
  { from: 'BOG', to: 'MIA', fromCity: 'Bogotá', toCity: 'Miami' },
  { from: 'SCL', to: 'EZE', fromCity: 'Santiago', toCity: 'Buenos Aires' },
  { from: 'BOG', to: 'MAD', fromCity: 'Bogotá', toCity: 'Madrid' },
];

export const HomePage: React.FC = () => {
  const outbound = addDaysToDate(getTomorrowDateString(), 6);

  return (
    <div className="bg-slate-50">
      <section className="brand-hero-bg relative overflow-hidden border-b border-brand-gold/30 px-4 pb-28 pt-14 text-white sm:px-6 sm:pb-36 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(#AB9159_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative z-10 mx-auto max-w-7xl text-center">
          <span className="mb-5 inline-block rounded-full border border-brand-gold/40 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-gold">
            Vuelos directos
          </span>
          <h1 className="mb-5 text-3xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">Reserva tu próximo vuelo</h1>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-lg">
            Busca, compara tarifas y compra en minutos. Todos los precios se muestran en dólares estadounidenses y con el desglose de impuestos.
          </p>
        </div>
      </section>

      <div className="relative z-20 mx-auto -mt-16 max-w-6xl px-4 sm:-mt-20 sm:px-6 lg:px-8">
        <SearchBar />
      </div>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8" aria-labelledby="rutas">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="rutas" className="text-xl font-black text-brand-black sm:text-2xl">
            Rutas populares
          </h2>
          <span className="text-xs text-slate-500">Búsqueda de ida para dentro de una semana</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR_ROUTES.map((route) => (
            <Link
              key={`${route.from}-${route.to}`}
              to={`/resultados?origin=${route.from}&destination=${route.to}&outbound=${outbound}&trip=OW&adt=1&sort=MAS_BARATOS`}
              className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-brand-gold hover:shadow-card"
            >
              <span>
                <span className="block text-sm font-bold text-brand-black">
                  {route.fromCity} → {route.toCity}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {route.from} · {route.to}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-brand-gold-dark" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" aria-label="Por qué comprar aquí">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
              <div className="shrink-0 rounded-xl bg-brand-gold-light p-3 text-brand-gold-dark">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="mb-1 text-sm font-bold text-slate-900">{title}</h3>
                <p className="text-xs leading-relaxed text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Lee cómo se forma el precio en{' '}
          <Link to="/transparencia" className="font-semibold text-brand-gold-dark hover:underline">
            Transparencia
          </Link>
          .
        </p>
      </section>
    </div>
  );
};
