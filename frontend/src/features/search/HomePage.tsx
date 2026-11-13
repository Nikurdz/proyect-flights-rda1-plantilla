import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SearchBar } from './SearchBar';

const FACTS = [
  { title: 'Solo vuelos directos', text: 'Sin escalas ni conexiones: la hora de llegada que ves es la real.' },
  { title: 'Tres tarifas por vuelo', text: 'Basic, Light y Full: compara equipaje, cambios y reembolso antes de elegir.' },
  { title: 'Asientos reservados 15 minutos', text: 'Mientras completas tus datos y el pago nadie más puede tomarlos.' },
  { title: 'Precio final desde el inicio', text: 'Ves el desglose de tarifa e impuestos antes de pagar, siempre en dólares.' },
];

const POPULAR_ROUTES: { from: string; to: string; fromCity: string; toCity: string }[] = [
  { from: 'UIO', to: 'GYE', fromCity: 'Quito', toCity: 'Guayaquil' },
  { from: 'UIO', to: 'GPS', fromCity: 'Quito', toCity: 'Galápagos' },
  { from: 'GYE', to: 'LOH', fromCity: 'Guayaquil', toCity: 'Loja' },
  { from: 'BOG', to: 'MDE', fromCity: 'Bogotá', toCity: 'Medellín' },
  { from: 'LIM', to: 'CUZ', fromCity: 'Lima', toCity: 'Cusco' },
  { from: 'BOG', to: 'MIA', fromCity: 'Bogotá', toCity: 'Miami' },
];

export const HomePage: React.FC = () => {
  // A route shortcut fills the form (it does not search): the traveller still sets dates and passengers,
  // then uses the one main action. The counter remounts the form so it takes the new airports.
  const [shortcut, setShortcut] = useState<{ origin: string; destination: string; n: number } | null>(null);

  useEffect(() => {
    document.title = 'Buscar vuelos | RAM Alliance';
  }, []);

  return (
    <div className="bg-paper">
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12 lg:px-8" aria-labelledby="buscar">
        <h1 id="buscar" className="mb-2 text-title font-semibold text-ink sm:text-display">
          ¿A dónde viajas?
        </h1>
        <p className="mb-6 max-w-[60ch] text-body text-muted">Elige tu ruta y tus fechas. Verás el precio final en dólares antes de pagar.</p>
        <SearchBar
          key={shortcut?.n ?? 0}
          defaults={shortcut ? { origin: shortcut.origin, destination: shortcut.destination } : undefined}
          focusSubmit={Boolean(shortcut)}
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8" aria-labelledby="rutas">
        <h2 id="rutas" className="text-lead font-semibold text-ink">
          Rutas frecuentes
        </h2>
        <p className="mb-4 mt-1 text-small text-muted">Toca una ruta para llenar el buscador; después elige fechas y pasajeros.</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR_ROUTES.map((route) => (
            <li key={`${route.from}-${route.to}`}>
              <button
                type="button"
                onClick={() => setShortcut({ origin: route.from, destination: route.to, n: (shortcut?.n ?? 0) + 1 })}
                className="group flex min-h-[52px] w-full items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-gold-text"
              >
                <span className="text-body font-medium text-ink">
                  {route.fromCity} a {route.toCity}
                </span>
                <ChevronRight className="h-4 w-4 text-muted transition-colors group-hover:text-gold-text" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line px-4 py-12 sm:px-6 lg:px-8" aria-label="Cómo compras en RAM Alliance">
        <div className="mx-auto max-w-6xl">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map(({ title, text }) => (
              <div key={title}>
                <dt className="text-body font-semibold text-ink">{title}</dt>
                <dd className="mt-1 text-small text-muted">{text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-small text-muted">
            ¿Quieres saber cómo se forma el precio? Lee{' '}
            <Link to="/transparencia" className="font-medium text-gold-text underline underline-offset-2">
              Transparencia de precios
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
};
